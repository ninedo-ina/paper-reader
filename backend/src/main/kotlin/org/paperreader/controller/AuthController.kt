package org.paperreader.controller

import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import org.paperreader.dto.*
import org.paperreader.exception.InvalidCredentialsException
import org.paperreader.exception.ResourceNotFoundException
import org.paperreader.repository.UserRepository
import org.paperreader.security.JwtUtil
import org.paperreader.security.UserPrincipal
import org.paperreader.service.AuthService
import org.paperreader.service.DeviceService
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/auth")
class AuthController(
    private val authService: AuthService,
    private val userRepository: UserRepository,
    private val jwtUtil: JwtUtil,
    private val deviceService: DeviceService,
) {

    @PostMapping("/register")
    fun register(
        @Valid @RequestBody request: RegisterRequest,
        httpRequest: HttpServletRequest,
    ): ApiResponse<TokenResponse> =
        ApiResponse(data = authService.register(request, deviceContext(httpRequest, null, null)))

    @PostMapping("/login")
    fun login(
        @Valid @RequestBody request: LoginRequest,
        httpRequest: HttpServletRequest,
    ): ApiResponse<TokenResponse> = ApiResponse(
        data = authService.login(request, deviceContext(httpRequest, request.deviceId, request.deviceName)),
    )

    @PostMapping("/send-code")
    fun sendCode(@Valid @RequestBody request: SendCodeRequest): ApiResponse<Nothing> {
        authService.sendEmailCode(request)
        return ApiResponse(message = "Verification code sent")
    }

    @PostMapping("/email-login")
    fun emailLogin(
        @Valid @RequestBody request: EmailLoginRequest,
        httpRequest: HttpServletRequest,
    ): ApiResponse<TokenResponse> = ApiResponse(
        data = authService.emailCodeLogin(request, deviceContext(httpRequest, request.deviceId, request.deviceName)),
    )

    @PostMapping("/github")
    fun githubLogin(
        @Valid @RequestBody request: GitHubAuthRequest,
        httpRequest: HttpServletRequest,
    ): ApiResponse<TokenResponse> = ApiResponse(
        data = authService.githubLogin(request, deviceContext(httpRequest, request.deviceId, request.deviceName)),
    )

    /** Second step of a login interrupted by the two-factor challenge. */
    @PostMapping("/two-factor/verify")
    fun verifyTwoFactor(
        @Valid @RequestBody request: TwoFactorVerifyRequest,
        httpRequest: HttpServletRequest,
    ): ApiResponse<TokenResponse> = ApiResponse(
        data = authService.verifyTwoFactor(
            request,
            deviceContext(httpRequest, request.deviceId, request.deviceName),
        ),
    )

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

    @PatchMapping("/profile")
    fun updateProfile(
        @Valid @RequestBody request: UpdateProfileRequest,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<UserProfile> =
        ApiResponse(data = authService.updateProfile(principal.userId, request))

    @PutMapping("/password")
    fun changePassword(
        @Valid @RequestBody request: ChangePasswordRequest,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<Nothing> {
        authService.changePassword(principal.userId, request)
        return ApiResponse(message = "Password changed")
    }

    @PostMapping("/refresh")
    fun refresh(
        @Valid @RequestBody request: RefreshTokenRequest,
        httpRequest: HttpServletRequest,
    ): ApiResponse<TokenResponse> {
        // Refreshing must not resurrect a device the user removed from the
        // trusted-device list.
        val claims = jwtUtil.extractClaims(request.refreshToken)
        val userId = claims.subject.toLong()
        val deviceKey = claims[JwtUtil.DEVICE_CLAIM] as? String
        if (!deviceService.isDeviceActive(userId, deviceKey)) {
            throw InvalidCredentialsException("该设备已被移除，请重新登录")
        }
        return ApiResponse(data = jwtUtil.refreshAccessToken(request.refreshToken))
    }

    private fun deviceContext(
        request: HttpServletRequest,
        deviceId: String?,
        deviceName: String?,
    ) = AuthService.DeviceContext(
        deviceKey = deviceId,
        deviceName = deviceName,
        userAgent = request.getHeader("User-Agent")?.take(500),
        ipAddress = clientIp(request),
    )

    private fun clientIp(request: HttpServletRequest): String? {
        val forwarded = request.getHeader("X-Forwarded-For")
        if (!forwarded.isNullOrBlank()) return forwarded.substringBefore(',').trim().take(64)
        return request.getHeader("X-Real-IP")?.take(64) ?: request.remoteAddr?.take(64)
    }
}
