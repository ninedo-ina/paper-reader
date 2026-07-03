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
        return generateTokens(user)
    }

    fun login(request: LoginRequest): TokenResponse {
        val user = userRepository.findByEmail(request.email)
            .orElseThrow { IllegalArgumentException("Invalid credentials") }

        require(user.passwordHash != null) {
            "This account uses ${user.authProvider} login, not password"
        }
        require(passwordEncoder.matches(request.password, user.passwordHash)) {
            "Invalid credentials"
        }
        return generateTokens(user)
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

        val user = userRepository.findByEmail(email).orElseGet {
            userRepository.save(
                User(
                    email = email,
                    displayName = email.substringBefore('@'),
                    authProvider = "email",
                )
            )
        }
        return generateTokens(user)
    }

    fun githubLogin(request: GitHubAuthRequest): TokenResponse {
        val accessToken = exchangeGithubToken(request.code)
        val githubUser = fetchGithubUser(accessToken)

        val user = userRepository.findByGithubId(githubUser.id).orElseGet {
            userRepository.findByEmail(githubUser.email ?: "${githubUser.login}@github.user")
                .map { existing ->
                    existing.copy(githubId = githubUser.id, avatarUrl = githubUser.avatarUrl)
                        .let { userRepository.save(it) }
                }
                .orElseGet {
                    userRepository.save(
                        User(
                            email = githubUser.email ?: "${githubUser.login}@github.user",
                            githubId = githubUser.id,
                            displayName = githubUser.name ?: githubUser.login,
                            avatarUrl = githubUser.avatarUrl,
                            authProvider = "github",
                        )
                    )
                }
        }

        return generateTokens(user)
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

    private fun generateTokens(user: User): TokenResponse {
        val accessToken = jwtUtil.generateAccessToken(user.id, user.email)
        val refreshToken = jwtUtil.generateRefreshToken(user.id, user.email)
        return TokenResponse(
            accessToken = accessToken,
            refreshToken = refreshToken,
            expiresIn = 3600000,
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
