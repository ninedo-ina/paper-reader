// =============================================================================
// 认证状态管理 — Zustand + localStorage 持久化
// =============================================================================

import { create } from "zustand"
import * as authApi from "@/lib/api/auth"
import { setTokens, clearTokens } from "@/lib/api/client"
import type { TokenResponse, LoginRequest, RegisterRequest, EmailLoginRequest } from "@/lib/api/types"

interface AuthState {
  // 状态
  accessToken: string | null
  refreshToken: string | null
  expiresIn: number | null
  isLoading: boolean
  error: string | null

  // 派生
  isAuthenticated: () => boolean

  // 操作
  login: (data: LoginRequest) => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  emailCodeLogin: (data: EmailLoginRequest) => Promise<void>
  restoreSession: (tokens: TokenResponse) => void
  logout: () => void
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  expiresIn: null,
  isLoading: false,
  error: null,

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
        isLoading: false,
      })
    } catch (e) {
      set({ isLoading: false, error: (e as Error).message })
      throw e
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null })
    try {
      const tokens = await authApi.register(data)
      setTokens(tokens.accessToken, tokens.refreshToken)
      persistSession(tokens)
      set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
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
        isLoading: false,
      })
    } catch (e) {
      set({ isLoading: false, error: (e as Error).message })
      throw e
    }
  },

  restoreSession: (tokens) => {
    setTokens(tokens.accessToken, tokens.refreshToken)
    set({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    })
  },

  logout: () => {
    clearTokens()
    clearPersistedSession()
    set({ accessToken: null, refreshToken: null, expiresIn: null, error: null })
  },

  clearError: () => set({ error: null }),
}))

// --- localStorage 持久化 ---

const SESSION_KEY = "pr_session"

function persistSession(tokens: TokenResponse) {
  if (typeof window !== "undefined") {
    localStorage.setItem(SESSION_KEY, JSON.stringify(tokens))
  }
}

function clearPersistedSession() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(SESSION_KEY)
  }
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
