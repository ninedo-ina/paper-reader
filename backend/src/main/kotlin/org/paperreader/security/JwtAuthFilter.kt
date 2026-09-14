package org.paperreader.security

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.paperreader.service.DeviceService
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

@Component
class JwtAuthFilter(
    private val jwtUtil: JwtUtil,
    private val deviceService: DeviceService,
) : OncePerRequestFilter() {

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        val authHeader = request.getHeader("Authorization")

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            val token = authHeader.substring(7)
            if (jwtUtil.isTokenValid(token)) {
                val claims = jwtUtil.extractClaims(token)
                val userId = claims.subject.toLong()
                val email = claims["email"] as String

                // A challenge token only proves the password step; it must not
                // be usable as an access token while 2FA is pending.
                val isChallenge = claims[JwtUtil.SCOPE_CLAIM] == JwtUtil.SCOPE_TWO_FACTOR_CHALLENGE
                // Deleting a device from the trusted-device list deletes its
                // row, so every token carrying that device key stops working
                // here and the user has to sign in again.
                val deviceActive = deviceService.isDeviceActive(userId, claims[JwtUtil.DEVICE_CLAIM] as? String)

                if (!isChallenge && deviceActive) {
                    val auth = UsernamePasswordAuthenticationToken(
                        UserPrincipal(userId, email),
                        null,
                        emptyList(),
                    )
                    SecurityContextHolder.getContext().authentication = auth
                }
            }
        }

        filterChain.doFilter(request, response)
    }
}
