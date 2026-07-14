// =============================================================================
// 认证 API — 注册、登录、邮箱验证码、GitHub OAuth
// =============================================================================

import { get, post, patch, put } from "./client"
import type {
  TokenResponse,
  LoginRequest,
  SendCodeRequest,
  EmailLoginRequest,
  GitHubAuthRequest,
  RefreshTokenRequest,
  UserProfile,
  UpdateProfileRequest,
  ChangePasswordRequest,
} from "./types"

/** 邮箱密码登录 */
export function login(data: LoginRequest): Promise<TokenResponse> {
  return post<TokenResponse>("/auth/login", data)
}

/** 发送邮箱验证码 */
export function sendEmailCode(data: SendCodeRequest): Promise<null> {
  return post<null>("/auth/send-code", data)
}

/** 邮箱验证码登录（无密码） */
export function emailCodeLogin(data: EmailLoginRequest): Promise<TokenResponse> {
  return post<TokenResponse>("/auth/email-login", data)
}

/** GitHub OAuth 登录 */
export function githubLogin(data: GitHubAuthRequest): Promise<TokenResponse> {
  return post<TokenResponse>("/auth/github", data)
}

/** 刷新 access token */
export function refreshToken(data: RefreshTokenRequest): Promise<TokenResponse> {
  return post<TokenResponse>("/auth/refresh", data)
}

/** 获取当前用户信息 */
export function getUserProfile(): Promise<UserProfile> {
  return get<UserProfile>("/auth/me")
}

/** 更新用户资料 */
export function updateProfile(data: UpdateProfileRequest): Promise<UserProfile> {
  return patch<UserProfile>("/auth/profile", data)
}

/** 修改密码 */
export function changePassword(data: ChangePasswordRequest): Promise<null> {
  return put<null>("/auth/password", data)
}
