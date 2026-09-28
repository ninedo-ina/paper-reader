package org.paperreader.dto

import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Pattern
import jakarta.validation.constraints.Size

data class ApiResponse<T>(
    val code: Int = 0,
    val message: String = "success",
    val data: T? = null,
)

/** 邮箱一列的长度上限，254 是 RFC 5321 对地址本身的规定。 */
private const val EMAIL_MAX = 254

data class LoginRequest(
    @field:NotBlank(message = "邮箱不能为空")
    @field:Email(message = "邮箱格式不正确")
    @field:Size(max = EMAIL_MAX, message = "邮箱长度超出限制")
    val email: String,
    // 不设最短长度：登录只是拿它去比对哈希，加下限会把历史上用短密码注册的老账号锁在门外。
    // 上限是为了别让超长字符串白跑一次 bcrypt。
    @field:NotBlank(message = "密码不能为空")
    @field:Size(max = 128, message = "密码长度超出限制")
    val password: String,
    /** Stable browser key, lets the backend recognise a trusted device. */
    val deviceId: String? = null,
    val deviceName: String? = null,
)

/**
 * 目前只有后端接口在用（前端没有注册表单），密码下限与改密接口保持一致（6 位）。
 * 上限 72 是 bcrypt 的有效长度：再长会被静默截断，不如直接拒掉。
 */
data class RegisterRequest(
    @field:NotBlank(message = "邮箱不能为空")
    @field:Email(message = "邮箱格式不正确")
    @field:Size(max = EMAIL_MAX, message = "邮箱长度超出限制")
    val email: String,
    @field:NotBlank(message = "密码不能为空")
    @field:Size(min = 6, max = 72, message = "密码长度需为 6-72 位")
    val password: String,
    val displayName: String? = null,
)

data class SendCodeRequest(
    @field:NotBlank(message = "邮箱不能为空")
    @field:Email(message = "邮箱格式不正确")
    @field:Size(max = EMAIL_MAX, message = "邮箱长度超出限制")
    val email: String,
)

data class EmailLoginRequest(
    @field:NotBlank(message = "邮箱不能为空")
    @field:Email(message = "邮箱格式不正确")
    @field:Size(max = EMAIL_MAX, message = "邮箱长度超出限制")
    val email: String,
    @field:NotBlank(message = "验证码不能为空")
    @field:Pattern(regexp = "\\d{6}", message = "验证码为 6 位数字")
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
