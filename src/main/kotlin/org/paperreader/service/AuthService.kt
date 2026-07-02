package org.paperreader.service

import org.paperreader.dto.LoginRequest
import org.paperreader.dto.RegisterRequest
import org.paperreader.dto.TokenResponse
import org.paperreader.model.User
import org.paperreader.repository.UserRepository
import org.paperreader.security.JwtUtil
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service

@Service
class AuthService(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
    private val jwtUtil: JwtUtil,
) {
    fun register(request: RegisterRequest): TokenResponse {
        require(!userRepository.existsByEmail(request.email)) { "Email already registered" }

        val user = userRepository.save(
            User(
                email = request.email,
                passwordHash = passwordEncoder.encode(request.password),
                displayName = request.displayName,
            )
        )

        return generateTokens(user)
    }

    fun login(request: LoginRequest): TokenResponse {
        val user = userRepository.findByEmail(request.email)
            .orElseThrow { IllegalArgumentException("Invalid credentials") }

        require(passwordEncoder.matches(request.password, user.passwordHash)) {
            "Invalid credentials"
        }

        return generateTokens(user)
    }

    private fun generateTokens(user: User): TokenResponse {
        val accessToken = jwtUtil.generateAccessToken(user.id, user.email)
        val refreshToken = jwtUtil.generateRefreshToken(user.id, user.email)
        return TokenResponse(
            accessToken = accessToken,
            refreshToken = refreshToken,
            expiresIn = 3600000,
        )
    }
}
