package org.paperreader.controller

import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import org.paperreader.dto.*
import org.paperreader.exception.ResourceNotFoundException
import org.paperreader.repository.UserRepository
import org.paperreader.security.JwtUtil
import org.paperreader.security.UserPrincipal
import org.paperreader.service.DeviceService
import org.paperreader.service.TwoFactorService
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

/**
 * Backs the two personal-centre menus: 两步验证 (authenticator binding and
 * recovery codes) and 信任设备 (the list of devices that have signed in).
 */
@RestController
@RequestMapping("/api/security")
class SecurityController(
    private val twoFactorService: TwoFactorService,
    private val deviceService: DeviceService,
    private val userRepository: UserRepository,
    private val jwtUtil: JwtUtil,
) {

    @GetMapping("/two-factor")
    fun status(@AuthenticationPrincipal principal: UserPrincipal): ApiResponse<TwoFactorStatusResponse> =
        ApiResponse(data = twoFactorService.status(currentUser(principal)))

    /** Step 1 of scan-and-bind: returns the secret and the otpauth:// URI. */
    @PostMapping("/two-factor/setup")
    fun setup(@AuthenticationPrincipal principal: UserPrincipal): ApiResponse<TwoFactorSetupResponse> =
        ApiResponse(data = twoFactorService.setup(currentUser(principal)))

    /** Step 2: confirm a code and receive the nine recovery codes exactly once. */
    @PostMapping("/two-factor/enable")
    fun enable(
        @Valid @RequestBody request: TwoFactorEnableRequest,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<TwoFactorEnableResponse> =
        ApiResponse(data = twoFactorService.enable(currentUser(principal), request.password, request.code))

    @PostMapping("/two-factor/disable")
    fun disable(
        @Valid @RequestBody request: TwoFactorDisableRequest,
        @AuthenticationPrincipal principal: UserPrincipal,
        httpRequest: HttpServletRequest,
    ): ApiResponse<Nothing> {
        val user = currentUser(principal)
        twoFactorService.disable(user, request.password, request.code)
        // With the factor off there is nothing left for a trusted device to
        // skip, so the trust is dropped along with it.
        deviceService.clearTrust(user.id)
        return ApiResponse(message = "两步验证已关闭")
    }

    /** Replaces the nine recovery codes with a fresh batch. */
    @PostMapping("/two-factor/recovery-codes")
    fun regenerate(
        @Valid @RequestBody request: RecoveryCodeRegenerateRequest,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<TwoFactorEnableResponse> =
        ApiResponse(data = twoFactorService.regenerateRecoveryCodes(currentUser(principal), request.password))

    @GetMapping("/devices")
    fun devices(
        @AuthenticationPrincipal principal: UserPrincipal,
        httpRequest: HttpServletRequest,
    ): ApiResponse<List<DeviceResponse>> {
        val currentKey = bearerToken(httpRequest)?.let {
            runCatching { jwtUtil.extractDeviceKey(it) }.getOrNull()
        }
        return ApiResponse(data = deviceService.list(principal.userId, currentKey))
    }

    /**
     * Removes devices. Their already-issued access and refresh tokens stop
     * working on the next request, so they must sign in again.
     */
    @PostMapping("/devices/delete")
    fun deleteDevices(
        @Valid @RequestBody request: DeleteDevicesRequest,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<Map<String, Int>> {
        val removed = deviceService.delete(principal.userId, request.ids)
        return ApiResponse(data = mapOf("removed" to removed))
    }

    private fun currentUser(principal: UserPrincipal) =
        userRepository.findById(principal.userId)
            .orElseThrow { ResourceNotFoundException("User", principal.userId) }

    private fun bearerToken(request: HttpServletRequest): String? =
        request.getHeader("Authorization")
            ?.takeIf { it.startsWith("Bearer ") }
            ?.substring(7)
}
