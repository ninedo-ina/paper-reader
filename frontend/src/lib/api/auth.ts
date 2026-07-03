// =============================================================================
// 认证 API — 注册、登录、邮箱验证码、GitHub OAuth
// =============================================================================

import { post } from "./client"
import type {
  TokenResponse,
  RegisterRequest,
  LoginRequest,
  SendCodeRequest,
  EmailLoginRequest,
  GitHubAuthRequest,
} from "./types"

/** 邮箱密码注册 */
export function register(data: RegisterRequest): Promise<TokenResponse> {
  return post<TokenResponse>("/auth/register", data)
}

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
