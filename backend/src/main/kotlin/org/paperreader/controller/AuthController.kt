package org.paperreader.controller

import jakarta.validation.Valid
import org.paperreader.dto.*
import org.paperreader.exception.ResourceNotFoundException
import org.paperreader.repository.UserRepository
import org.paperreader.security.JwtUtil
import org.paperreader.security.UserPrincipal
import org.paperreader.service.AuthService
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/auth")
class AuthController(
    private val authService: AuthService,
    private val userRepository: UserRepository,
    private val jwtUtil: JwtUtil,
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

    @GetMapping("/me")
    fun me(@AuthenticationPrincipal principal: UserPrincipal): ApiResponse<UserProfile> {
        val user = userRepository.findById(principal.userId)
            .orElseThrow { ResourceNotFoundException("User", principal.userId) }
        return ApiResponse(data = UserProfile(
            id = user.id,
            email = user.email,
            displayName = user.displayName,
            avatarUrl = user.avatarUrl,
            authProvider = user.authProvider,
        ))
    }

    @PostMapping("/refresh")
    fun refresh(@Valid @RequestBody request: RefreshTokenRequest): ApiResponse<TokenResponse> =
        ApiResponse(data = jwtUtil.refreshAccessToken(request.refreshToken))
}
