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

    companion object {
        /** Claim holding the device key; absent on tokens issued before devices existed. */
        const val DEVICE_CLAIM = "did"
        /** Claim marking a short-lived token that only proves the first login step passed. */
        const val SCOPE_CLAIM = "scope"
        const val SCOPE_TWO_FACTOR_CHALLENGE = "2fa_challenge"
        /** How long the user has to type a TOTP or recovery code. */
        const val CHALLENGE_EXPIRATION = 5 * 60 * 1000L
    }

    fun generateAccessToken(userId: Long, email: String, deviceKey: String? = null): String =
        generateToken(userId, email, accessTokenExpiration, deviceKey, null)

    fun generateRefreshToken(userId: Long, email: String, deviceKey: String? = null): String =
        generateToken(userId, email, refreshTokenExpiration, deviceKey, null)

    /**
     * Token returned between the password step and the second factor. It is
     * deliberately not accepted as an access token: [JwtAuthFilter] rejects any
     * token carrying the challenge scope.
     */
    fun generateTwoFactorChallengeToken(userId: Long, email: String, deviceKey: String?): String =
        generateToken(userId, email, CHALLENGE_EXPIRATION, deviceKey, SCOPE_TWO_FACTOR_CHALLENGE)

    private fun generateToken(
        userId: Long,
        email: String,
        expiration: Long,
        deviceKey: String?,
        scope: String?,
    ): String {
        val builder = Jwts.builder()
            .subject(userId.toString())
            .claim("email", email)
        if (deviceKey != null) builder.claim(DEVICE_CLAIM, deviceKey)
        if (scope != null) builder.claim(SCOPE_CLAIM, scope)
        return builder
            .issuedAt(Date())
            .expiration(Date(System.currentTimeMillis() + expiration))
            .signWith(key)
            .compact()
    }

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

    fun extractDeviceKey(token: String): String? =
        extractClaims(token)[DEVICE_CLAIM] as? String

    /** True for the intermediate token handed out before the second factor. */
    fun isTwoFactorChallenge(token: String): Boolean = try {
        extractClaims(token)[SCOPE_CLAIM] == SCOPE_TWO_FACTOR_CHALLENGE
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
        // Carry the device key across the refresh so a revoked device also
        // loses access on its next token rotation, not only at expiry.
        val deviceKey = claims[DEVICE_CLAIM] as? String
        return TokenResponse(
            accessToken = generateAccessToken(userId, email, deviceKey),
            refreshToken = generateRefreshToken(userId, email, deviceKey),
            expiresIn = accessTokenExpiration,
            isNewUser = false,
        )
    }
}
