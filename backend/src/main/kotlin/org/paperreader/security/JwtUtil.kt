package org.paperreader.security

import io.jsonwebtoken.Claims
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import org.paperreader.dto.TokenResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.util.*
import javax.crypto.SecretKey

@Component
class JwtUtil(
    @Value("\${app.jwt.secret}") secret: String,
    @Value("\${app.jwt.access-token-expiration}") private val accessTokenExpiration: Long,
    @Value("\${app.jwt.refresh-token-expiration}") private val refreshTokenExpiration: Long,
) {
    private val key: SecretKey = Keys.hmacShaKeyFor(secret.toByteArray())

    fun generateAccessToken(userId: Long, email: String): String =
        generateToken(userId, email, accessTokenExpiration)

    fun generateRefreshToken(userId: Long, email: String): String =
        generateToken(userId, email, refreshTokenExpiration)

    private fun generateToken(userId: Long, email: String, expiration: Long): String =
        Jwts.builder()
            .subject(userId.toString())
            .claim("email", email)
            .issuedAt(Date())
            .expiration(Date(System.currentTimeMillis() + expiration))
            .signWith(key)
            .compact()

    fun extractClaims(token: String): Claims =
        Jwts.parser()
            .verifyWith(key)
            .build()
            .parseSignedClaims(token)
            .payload

    fun isTokenValid(token: String): Boolean = try {
        extractClaims(token)
        true
    } catch (e: Exception) {
        false
    }

    fun extractUserId(token: String): Long =
        extractClaims(token).subject.toLong()

    fun extractEmail(token: String): String =
        extractClaims(token)["email"] as? String ?: throw IllegalArgumentException("Invalid token: missing email claim")

    fun refreshAccessToken(refreshToken: String): TokenResponse {
        val claims = extractClaims(refreshToken)
        val userId = claims.subject.toLong()
        val email = claims["email"] as? String ?: throw IllegalArgumentException("Invalid refresh token")
        return TokenResponse(
            accessToken = generateAccessToken(userId, email),
            refreshToken = generateRefreshToken(userId, email),
            expiresIn = accessTokenExpiration,
            isNewUser = false,
        )
    }
}
