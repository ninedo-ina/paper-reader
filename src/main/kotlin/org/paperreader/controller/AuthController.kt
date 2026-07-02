package org.paperreader.controller

import jakarta.validation.Valid
import org.paperreader.dto.*
import org.paperreader.service.AuthService
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/auth")
class AuthController(
    private val authService: AuthService,
) {

    @PostMapping("/register")
    fun register(@Valid @RequestBody request: RegisterRequest): ApiResponse<TokenResponse> =
        ApiResponse(data = authService.register(request))

    @PostMapping("/login")
    fun login(@Valid @RequestBody request: LoginRequest): ApiResponse<TokenResponse> =
        ApiResponse(data = authService.login(request))

    @PostMapping("/send-code")
    fun sendCode(@Valid @RequestBody request: SendCodeRequest): ApiResponse<Nothing> {
        authService.sendEmailCode(request)
        return ApiResponse(message = "Verification code sent")
    }

    @PostMapping("/email-login")
    fun emailLogin(@Valid @RequestBody request: EmailLoginRequest): ApiResponse<TokenResponse> =
        ApiResponse(data = authService.emailCodeLogin(request))

    @PostMapping("/github")
    fun githubLogin(@Valid @RequestBody request: GitHubAuthRequest): ApiResponse<TokenResponse> =
        ApiResponse(data = authService.githubLogin(request))
}
