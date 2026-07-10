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

  // 派生
  isAuthenticated: () => boolean

  // 操作
  login: (data: LoginRequest) => Promise<void>
  emailCodeLogin: (data: EmailLoginRequest) => Promise<void>
  githubLogin: (code: string) => Promise<void>
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

  isAuthenticated: () => !!get().accessToken,

  login: async (data) => {
    set({ isLoading: true, error: null })
    try {
      const tokens = await authApi.login(data)
      setTokens(tokens.accessToken, tokens.refreshToken)
      persistSession(tokens)
      set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        isNewUser: tokens.isNewUser,
        isLoading: false,
      })
    } catch (e) {
      set({ isLoading: false, error: (e as Error).message })
      throw e
    }
  },

  emailCodeLogin: async (data) => {
    set({ isLoading: true, error: null })
    try {
      const tokens = await authApi.emailCodeLogin(data)
      setTokens(tokens.accessToken, tokens.refreshToken)
      persistSession(tokens)
      set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        isNewUser: tokens.isNewUser,
        isLoading: false,
      })
    } catch (e) {
      set({ isLoading: false, error: (e as Error).message })
      throw e
    }
  },

  githubLogin: async (code) => {
    set({ isLoading: true, error: null })
    try {
      const tokens = await authApi.githubLogin({ code })
      setTokens(tokens.accessToken, tokens.refreshToken)
      persistSession(tokens)
      set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        isNewUser: tokens.isNewUser,
        isLoading: false,
      })
    } catch (e) {
      set({ isLoading: false, error: (e as Error).message })
      throw e
    }
  },

  refreshSession: async () => {
    const rt = get().refreshToken
    if (!rt) throw new Error("No refresh token")
    const tokens = await authApi.refreshToken({ refreshToken: rt })
    setTokens(tokens.accessToken, tokens.refreshToken)
    persistSession(tokens)
    set({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    })
  },

  restoreSession: (tokens) => {
    setTokens(tokens.accessToken, tokens.refreshToken)
    set({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    })
  },

  consumeNewUserFlag: () => set({ isNewUser: null }),

  logout: () => {
    clearTokens()
    clearPersistedSession()
    set({ accessToken: null, refreshToken: null, expiresIn: null, isNewUser: null, error: null })
  },

  clearError: () => set({ error: null }),
}))

// --- localStorage 持久化 ---

const SESSION_KEY = "pr_session"

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
