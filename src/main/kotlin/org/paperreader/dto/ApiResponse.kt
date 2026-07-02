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

data class TokenResponse(
    val accessToken: String,
    val refreshToken: String,
    val expiresIn: Long,
)

data class PageResponse<T>(
    val items: List<T>,
    val total: Long,
    val page: Int,
    val pageSize: Int,
)
