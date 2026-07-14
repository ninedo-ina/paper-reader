package org.paperreader.service

import com.fasterxml.jackson.databind.ObjectMapper
import org.paperreader.dto.*
import org.paperreader.model.User
import org.paperreader.repository.UserRepository
import org.paperreader.security.JwtUtil
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.http.*
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.util.LinkedMultiValueMap
import org.springframework.web.client.RestTemplate
import java.security.SecureRandom
import java.time.Duration

@Service
class AuthService(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
    private val jwtUtil: JwtUtil,
    private val redisTemplate: RedisTemplate<String, String>,
    private val restTemplate: RestTemplate,
    private val objectMapper: ObjectMapper,
    @Value("\${app.github.client-id}") private val githubClientId: String,
    @Value("\${app.github.client-secret}") private val githubClientSecret: String,
    @Value("\${app.mail.from}") private val mailFrom: String,
) {
    private val logger = LoggerFactory.getLogger(AuthService::class.java)
    private val random = SecureRandom()

    fun register(request: RegisterRequest): TokenResponse {
        require(!userRepository.existsByEmail(request.email)) { "Email already registered" }

        val user = userRepository.save(
            User(
                email = request.email,
                passwordHash = passwordEncoder.encode(request.password),
                displayName = request.displayName,
                authProvider = "local",
            )
        )
        return generateTokens(user, isNewUser = true)
    }

    fun login(request: LoginRequest): TokenResponse {
        val existing = userRepository.findByEmail(request.email)
        val (user, isNew) = if (existing.isPresent) {
            val u = existing.get()
            require(u.passwordHash != null) {
                "This account uses ${u.authProvider} login, not password"
            }
            require(passwordEncoder.matches(request.password, u.passwordHash)) {
                "Invalid credentials"
            }
            u to false
        } else {
            userRepository.save(
                User(
                    email = request.email.trim().lowercase(),
                    passwordHash = passwordEncoder.encode(request.password),
                    displayName = request.email.trim().lowercase().substringBefore('@'),
                    authProvider = "local",
                )
            ) to true
        }
        return generateTokens(user, isNewUser = isNew)
    }

    fun sendEmailCode(request: SendCodeRequest) {
        val email = request.email.trim().lowercase()
        val code = String.format("%06d", random.nextInt(1_000_000))
        val key = "pr:email_code:$email"

        redisTemplate.opsForValue().set(key, code, Duration.ofMinutes(5))
        logger.info("Email verification code for {}: {}", email, code)

        // TODO: integrate with real mail service (SMTP/SendGrid/etc.)
        // For now, the code is logged — in production, send it via email
    }

    fun emailCodeLogin(request: EmailLoginRequest): TokenResponse {
        val email = request.email.trim().lowercase()
        val code = request.code.trim()

        val storedCode = redisTemplate.opsForValue().get("pr:email_code:$email")
            ?: throw IllegalArgumentException("Verification code expired or not sent")
        require(storedCode == code) { "Invalid verification code" }

        redisTemplate.delete("pr:email_code:$email")

        val existing = userRepository.findByEmail(email)
        val (user, isNew) = if (existing.isPresent) {
            existing.get() to false
        } else {
            userRepository.save(
                User(
                    email = email,
                    displayName = email.substringBefore('@'),
                    authProvider = "email",
                )
            ) to true
        }
        return generateTokens(user, isNewUser = isNew)
    }

    fun githubLogin(request: GitHubAuthRequest): TokenResponse {
        val accessToken = exchangeGithubToken(request.code)
        val githubUser = fetchGithubUser(accessToken)

        val byGithubId = userRepository.findByGithubId(githubUser.id)
        if (byGithubId.isPresent) {
            return generateTokens(byGithubId.get(), isNewUser = false)
        }

        val email = githubUser.email ?: "${githubUser.login}@github.user"
        val byEmail = userRepository.findByEmail(email)
        if (byEmail.isPresent) {
            val linked = byEmail.get().copy(githubId = githubUser.id, avatarUrl = githubUser.avatarUrl)
                .let { userRepository.save(it) }
            return generateTokens(linked, isNewUser = false)
        }

        val newUser = userRepository.save(
            User(
                email = email,
                githubId = githubUser.id,
                displayName = githubUser.name ?: githubUser.login,
                avatarUrl = githubUser.avatarUrl,
                authProvider = "github",
            )
        )
        return generateTokens(newUser, isNewUser = true)
    }

    private fun exchangeGithubToken(code: String): String {
        val body = LinkedMultiValueMap<String, String>()
        body.add("client_id", githubClientId)
        body.add("client_secret", githubClientSecret)
        body.add("code", code)

        val headers = HttpHeaders().apply { contentType = MediaType.APPLICATION_FORM_URLENCODED }
        headers.accept = listOf(MediaType.APPLICATION_JSON)

        val resp = restTemplate.postForEntity(
            "https://github.com/login/oauth/access_token",
            HttpEntity(body, headers),
            Map::class.java,
        )

        val token = resp.body?.get("access_token") as? String
            ?: throw RuntimeException("Failed to exchange GitHub token: ${resp.body}")
        return token
    }

    private fun fetchGithubUser(accessToken: String): GithubUser {
        val headers = HttpHeaders().apply {
            setBearerAuth(accessToken)
            accept = listOf(MediaType.APPLICATION_JSON)
        }
        val resp = restTemplate.exchange(
            "https://api.github.com/user",
            HttpMethod.GET,
            HttpEntity<String>(headers),
            Map::class.java,
        )
        val body = resp.body ?: throw RuntimeException("GitHub user API returned null")
        return GithubUser(
            id = (body["id"] as Number).toLong(),
            login = body["login"] as? String ?: "",
            name = body["name"] as? String,
            email = body["email"] as? String,
            avatarUrl = body["avatar_url"] as? String,
        )
    }

    fun updateProfile(userId: Long, request: UpdateProfileRequest): UserProfile {
        val user = userRepository.findById(userId).orElseThrow {
            IllegalArgumentException("User not found")
        }
        val updated = user.copy(
            displayName = request.displayName ?: user.displayName,
            avatarUrl = request.avatarUrl ?: user.avatarUrl,
        ).let { userRepository.save(it) }
        return UserProfile(
            id = updated.id,
            email = updated.email,
            displayName = updated.displayName,
            avatarUrl = updated.avatarUrl,
            authProvider = updated.authProvider,
        )
    }

    fun changePassword(userId: Long, request: ChangePasswordRequest) {
        val user = userRepository.findById(userId).orElseThrow {
            IllegalArgumentException("User not found")
        }
        require(user.passwordHash != null) {
            "This account uses ${user.authProvider} login, password change not available"
        }
        require(passwordEncoder.matches(request.currentPassword, user.passwordHash)) {
            "Current password is incorrect"
        }
        require(request.newPassword.length >= 6) {
            "New password must be at least 6 characters"
        }
        userRepository.save(user.copy(passwordHash = passwordEncoder.encode(request.newPassword)))
    }

    private fun generateTokens(user: User, isNewUser: Boolean = false): TokenResponse {
        val accessToken = jwtUtil.generateAccessToken(user.id, user.email)
        val refreshToken = jwtUtil.generateRefreshToken(user.id, user.email)
        return TokenResponse(
            accessToken = accessToken,
            refreshToken = refreshToken,
            expiresIn = 3600000,
            isNewUser = isNewUser,
        )
    }

    private data class GithubUser(
        val id: Long,
        val login: String,
        val name: String?,
        val email: String?,
        val avatarUrl: String?,
    )
}
