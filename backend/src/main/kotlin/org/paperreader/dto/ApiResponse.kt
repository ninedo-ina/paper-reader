package org.paperreader.dto

data class ApiResponse<T>(
    val code: Int = 0,
    val message: String = "success",
    val data: T? = null,
)

data class LoginRequest(
    val email: String,
    val password: String,
    /** Stable browser key, lets the backend recognise a trusted device. */
    val deviceId: String? = null,
    val deviceName: String? = null,
)

data class RegisterRequest(
    val email: String,
    val password: String,
    val displayName: String? = null,
)

data class SendCodeRequest(
    val email: String,
)

data class EmailLoginRequest(
    val email: String,
    val code: String,
    val deviceId: String? = null,
    val deviceName: String? = null,
)

data class GitHubAuthRequest(
    val code: String,
    val deviceId: String? = null,
    val deviceName: String? = null,
)

data class TokenResponse(
    val accessToken: String? = null,
    val refreshToken: String? = null,
    val expiresIn: Long = 0,
    val isNewUser: Boolean = false,
    /**
     * True when the password/email/GitHub step succeeded but the account has
     * two-factor authentication on and this device is not trusted yet. The
     * client must then call `/api/auth/two-factor/verify` with [challengeToken].
     */
    val twoFactorRequired: Boolean = false,
    val challengeToken: String? = null,
)

data class PageResponse<T>(
    val items: List<T>,
    val total: Long,
    val page: Int,
    val pageSize: Int,
)

data class RefreshTokenRequest(
    val refreshToken: String,
)

data class UserProfile(
    val id: Long,
    val email: String,
    val displayName: String?,
    val avatarUrl: String?,
    val authProvider: String,
)

data class UpdateProfileRequest(
    val displayName: String? = null,
    val avatarUrl: String? = null,
)

data class ChangePasswordRequest(
    val currentPassword: String,
    val newPassword: String,
)
