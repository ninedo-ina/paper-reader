package org.paperreader.dto

data class TwoFactorStatusResponse(
    val enabled: Boolean,
    val recoveryCodesRemaining: Int,
    val recoveryCodesTotal: Int,
)

data class TwoFactorSetupResponse(
    /** Base32 secret, shown as text for manual entry alongside the QR code. */
    val secret: String,
    val otpauthUri: String,
    val digits: Int,
    val period: Long,
)

data class TwoFactorEnableResponse(
    /** Plaintext recovery codes — returned exactly once, right after enabling. */
    val recoveryCodes: List<String>,
)

data class TwoFactorEnableRequest(
    val password: String,
    val code: String,
)

data class TwoFactorDisableRequest(
    val password: String,
    val code: String,
)

data class RecoveryCodeRegenerateRequest(
    val password: String,
)

/** Second step of a login that was interrupted by the two-factor challenge. */
data class TwoFactorVerifyRequest(
    val challengeToken: String,
    /** A 6-digit TOTP code or one of the 9 recovery codes. */
    val code: String,
    /** When true the device is remembered and may skip 2FA next time. */
    val trustDevice: Boolean = false,
    val deviceId: String? = null,
    val deviceName: String? = null,
)

data class DeviceResponse(
    val id: Long,
    val deviceKey: String,
    val deviceName: String,
    val userAgent: String?,
    val ipAddress: String?,
    val trusted: Boolean,
    val trustedUntil: String?,
    val lastLoginAt: String,
    /** True for the device that issued the current request. */
    val current: Boolean = false,
)

data class DeleteDevicesRequest(
    val ids: List<Long>,
)
