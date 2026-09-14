// =============================================================================
// 认证状态管理 — Zustand + localStorage 持久化
// =============================================================================

import { create } from "zustand"
import * as authApi from "@/lib/api/auth"
import type { TokenResponse, LoginRequest, EmailLoginRequest } from "@/lib/api/types"
import { setTokens, clearTokens } from "@/lib/api/client"

interface AuthState {
  // 状态
  accessToken: string | null
  refreshToken: string | null
  expiresIn: number | null
  isLoading: boolean
  error: string | null
  isNewUser: boolean | null
  /** 账号开了两步验证且本设备未受信任时，后端返回的临时凭证 */
  twoFactorChallengeToken: string | null

  // 派生
  isAuthenticated: () => boolean

  // 操作
  login: (data: LoginRequest) => Promise<void>
  emailCodeLogin: (data: EmailLoginRequest) => Promise<void>
  githubLogin: (code: string) => Promise<void>
  verifyTwoFactor: (code: string, trustDevice: boolean) => Promise<void>
  cancelTwoFactor: () => void
  /** 从 sessionStorage 恢复跳转前留下的待验证凭证 */
  hydrateChallenge: () => void
  refreshSession: () => Promise<void>
  restoreSession: (tokens: TokenResponse) => void
  consumeNewUserFlag: () => void
  logout: () => void
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  expiresIn: null,
  isLoading: false,
  error: null,
  isNewUser: null,
  twoFactorChallengeToken: null,

  isAuthenticated: () => !!get().accessToken,

  login: async (data) => {
    set({ isLoading: true, error: null })
    try {
      const tokens = await authApi.login(data)
      applyTokens(tokens, set)
    } catch (e) {
      set({ isLoading: false, error: (e as Error).message })
      throw e
    }
  },

  emailCodeLogin: async (data) => {
    set({ isLoading: true, error: null })
    try {
      const tokens = await authApi.emailCodeLogin(data)
      applyTokens(tokens, set)
    } catch (e) {
      set({ isLoading: false, error: (e as Error).message })
      throw e
    }
  },

  githubLogin: async (code) => {
    set({ isLoading: true, error: null })
    try {
      const tokens = await authApi.githubLogin({ code })
      applyTokens(tokens, set)
    } catch (e) {
      set({ isLoading: false, error: (e as Error).message })
      throw e
    }
  },

  verifyTwoFactor: async (code, trustDevice) => {
    const challengeToken = get().twoFactorChallengeToken
    if (!challengeToken) throw new Error("两步验证会话已过期，请重新登录")
    set({ isLoading: true, error: null })
    try {
      const tokens = await authApi.verifyTwoFactor({ challengeToken, code, trustDevice })
      applyTokens(tokens, set)
    } catch (e) {
      set({ isLoading: false, error: (e as Error).message })
      throw e
    }
  },

  cancelTwoFactor: () => {
    persistChallenge(null)
    set({ twoFactorChallengeToken: null, isLoading: false, error: null })
  },

  hydrateChallenge: () => {
    const token = loadPendingChallenge()
    if (token) set({ twoFactorChallengeToken: token })
  },

  refreshSession: async () => {
    const rt = get().refreshToken
    if (!rt) throw new Error("No refresh token")
    const tokens = await authApi.refreshToken({ refreshToken: rt })
    applyTokens(tokens, set)
  },

  restoreSession: (tokens) => {
    applyTokens(tokens, set)
  },

  consumeNewUserFlag: () => set({ isNewUser: null }),

  logout: () => {
    clearTokens()
    clearPersistedSession()
    set({
      accessToken: null,
      refreshToken: null,
      expiresIn: null,
      isNewUser: null,
      error: null,
      twoFactorChallengeToken: null,
    })
  },

  clearError: () => set({ error: null }),
}))

type SetState = (partial: Partial<AuthState>) => void

/**
 * 登录接口的两种结果：直接拿到 token，或拿到一个待验证的挑战凭证。
 * 只有仍在「待二次验证」的会话不写持久化，避免刷新页面后卡在半登录状态。
 */
function applyTokens(tokens: TokenResponse, set: SetState) {
  if (tokens.twoFactorRequired || !tokens.accessToken || !tokens.refreshToken) {
    // GitHub 回调是整页跳转，把挑战凭证放进 sessionStorage 才能在登录页接上
    persistChallenge(tokens.challengeToken ?? null)
    set({
      twoFactorChallengeToken: tokens.challengeToken ?? null,
      accessToken: null,
      refreshToken: null,
      expiresIn: null,
      isNewUser: null,
      isLoading: false,
      error: null,
    })
    return
  }
  persistChallenge(null)
  setTokens(tokens.accessToken, tokens.refreshToken)
  persistSession(tokens)
  set({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
    isNewUser: tokens.isNewUser,
    twoFactorChallengeToken: null,
    isLoading: false,
    error: null,
  })
}

// --- localStorage 持久化 ---

const SESSION_KEY = "pr_session"
const CHALLENGE_KEY = "pr_2fa_challenge"

function persistChallenge(token: string | null) {
  if (typeof window === "undefined") return
  try {
    if (token) sessionStorage.setItem(CHALLENGE_KEY, token)
    else sessionStorage.removeItem(CHALLENGE_KEY)
  } catch {
    // 忽略隐私模式下的存储异常
  }
}

/** 页面跳转前留下的待验证凭证（GitHub 登录回调场景） */
export function loadPendingChallenge(): string | null {
  if (typeof window === "undefined") return null
  try {
    return sessionStorage.getItem(CHALLENGE_KEY)
  } catch {
    return null
  }
}

function persistSession(tokens: TokenResponse) {
  if (typeof window === "undefined") return
  localStorage.setItem(SESSION_KEY, JSON.stringify(tokens))
  document.cookie = `pr_session=1; path=/; max-age=2592000; SameSite=Lax`
}

function clearPersistedSession() {
  if (typeof window === "undefined") return
  localStorage.removeItem(SESSION_KEY)
  document.cookie = "pr_session=; path=/; max-age=0"
}

/** 从 localStorage 恢复 session（应用启动时调用） */
export function loadPersistedSession(): TokenResponse | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const tokens: TokenResponse = JSON.parse(raw)
    // 简单校验数据完整性
    if (tokens.accessToken && tokens.refreshToken) return tokens
    return null
  } catch {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}
