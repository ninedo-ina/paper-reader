// =============================================================================
// API 请求客户端 — JWT 认证 + 自动刷新 + 错误映射
// =============================================================================

import type { ApiResponse, TokenResponse } from "./types"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api"

let accessToken: string | null = null
let refreshToken: string | null = null
let refreshPromise: Promise<boolean> | null = null // 防止并发刷新

/** 外部设置 token（登录后由 auth-store 调用） */
export function setTokens(access: string, refresh: string) {
  accessToken = access
  refreshToken = refresh
}

/** 清除 token（登出时调用） */
export function clearTokens() {
  accessToken = null
  refreshToken = null
}

class ApiError extends Error {
  code: number
  constructor(code: number, message: string) {
    super(message)
    this.code = code
    this.name = "ApiError"
  }
}

/** 使用 refreshToken 换取新 accessToken */
async function doRefresh(): Promise<boolean> {
  if (!refreshToken) return false
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) return false
    const json: ApiResponse<TokenResponse> = await res.json()
    if (json.code === 0 && json.data) {
      accessToken = json.data.accessToken
      refreshToken = json.data.refreshToken
      return true
    }
    return false
  } catch {
    return false
  }
}

/** 有锁的 refresh，避免并发请求都触发刷新 */
async function refreshIfNeeded(): Promise<boolean> {
  if (refreshPromise) return refreshPromise
  refreshPromise = doRefresh().finally(() => { refreshPromise = null })
  return refreshPromise
}

/** 错误码映射为用户可读消息 */
function errorMessage(code: number, fallback: string): string {
  switch (code) {
    case 1001: return "登录已过期，请重新登录"
    case 1002: return "权限不足"
    case 1003: return "参数错误"
    case 1004: return "资源不存在"
    default: return fallback
  }
}

/**
 * 核心请求函数。
 * 自动附加 Bearer Token，401 时尝试刷新 token 并重试一次。
 */
export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_URL}${path}`
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }

  // 非 FormData 请求默认 JSON
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json"
  }

  // 附加 JWT
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`
  }

  let res = await fetch(url, { ...options, headers })

  // 401/403 → 尝试刷新 token → 重试
  if ((res.status === 401 || res.status === 403) && refreshToken) {
    const refreshed = await refreshIfNeeded()
    if (refreshed) {
      headers["Authorization"] = `Bearer ${accessToken}`
      res = await fetch(url, { ...options, headers })
    }
  }

  // 解析 JSON 响应（处理空 body 等非 JSON 情况）
  let json: ApiResponse<T>
  try {
    json = await res.json()
  } catch {
    const text = await res.text().catch(() => "")
    throw new ApiError(res.status, text || `Request failed (HTTP ${res.status})`)
  }

  if (!json || typeof json.code === "undefined") {
    throw new ApiError(res.status, `Unexpected response (HTTP ${res.status})`)
  }

  if (json.code !== 0) {
    throw new ApiError(json.code, errorMessage(json.code, json.message))
  }

  return json.data as T
}

/** GET 请求 */
export function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: "GET" })
}

/** POST 请求（JSON body） */
export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  })
}

/** POST 请求（FormData body，用于文件上传） */
export function postForm<T>(path: string, formData: FormData): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: formData,
  })
}

/** PUT 请求 */
export function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "PUT",
    body: body ? JSON.stringify(body) : undefined,
  })
}

/** DELETE 请求 */
export function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" })
}
