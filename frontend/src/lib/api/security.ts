// =============================================================================
// 安全中心 API — 两步验证（TOTP / 恢复码）与信任设备
// =============================================================================

import { get, post } from "./client"
import type {
  TwoFactorStatus,
  TwoFactorSetup,
  TwoFactorEnableRequest,
  TwoFactorDisableRequest,
  TwoFactorEnableResponse,
  RecoveryCodeRegenerateRequest,
  TrustedDevice,
} from "./types"

/** 当前两步验证状态（是否开启、剩余恢复码数量） */
export function getTwoFactorStatus(): Promise<TwoFactorStatus> {
  return get<TwoFactorStatus>("/security/two-factor")
}

/** 第一步：生成密钥与 otpauth:// 地址，前端据此渲染二维码 */
export function setupTwoFactor(): Promise<TwoFactorSetup> {
  return post<TwoFactorSetup>("/security/two-factor/setup", {})
}

/** 第二步：校验密码 + 动态码，成功后返回 9 个恢复码（只返回这一次） */
export function enableTwoFactor(data: TwoFactorEnableRequest): Promise<TwoFactorEnableResponse> {
  return post<TwoFactorEnableResponse>("/security/two-factor/enable", data)
}

/** 关闭两步验证，同时作废所有恢复码 */
export function disableTwoFactor(data: TwoFactorDisableRequest): Promise<null> {
  return post<null>("/security/two-factor/disable", data)
}

/** 重新生成 9 个恢复码（旧的立即失效） */
export function regenerateRecoveryCodes(
  data: RecoveryCodeRegenerateRequest,
): Promise<TwoFactorEnableResponse> {
  return post<TwoFactorEnableResponse>("/security/two-factor/recovery-codes", data)
}

/** 已登录过的设备列表 */
export function getTrustedDevices(): Promise<TrustedDevice[]> {
  return get<TrustedDevice[]>("/security/devices")
}

/** 删除设备；被删设备的登录 token 立即失效，需要重新登录 */
export function deleteTrustedDevices(ids: number[]): Promise<{ removed: number }> {
  return post<{ removed: number }>("/security/devices/delete", { ids })
}
