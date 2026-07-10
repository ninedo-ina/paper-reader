package org.paperreader.dto

data class ApiResponse<T>(
    val code: Int = 0,
    val message: String = "success",
    val data: T? = null,
)

data class LoginRequest(
    val email: String,
    val password: String,
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
)

data class GitHubAuthRequest(
    val code: String,
)

data class TokenResponse(
    val accessToken: String,
    val refreshToken: String,
    val expiresIn: Long,
    val isNewUser: Boolean = false,
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
