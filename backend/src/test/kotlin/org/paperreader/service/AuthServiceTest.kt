package org.paperreader.service

import com.fasterxml.jackson.databind.ObjectMapper
import io.mockk.every
import io.mockk.verify
import io.mockk.impl.annotations.MockK
import io.mockk.junit5.MockKExtension
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.paperreader.dto.*
import org.paperreader.model.User
import org.paperreader.model.UserDevice
import org.paperreader.exception.InvalidCredentialsException
import org.paperreader.repository.UserRepository
import org.paperreader.security.JwtUtil
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.data.redis.core.ValueOperations
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.web.client.RestTemplate
import java.time.Duration
import java.util.*
import org.junit.jupiter.api.Assertions.assertEquals

@ExtendWith(MockKExtension::class)
class AuthServiceTest {

    @MockK
    private lateinit var userRepository: UserRepository

    @MockK
    private lateinit var passwordEncoder: PasswordEncoder

    @MockK
    private lateinit var jwtUtil: JwtUtil

    @MockK
    private lateinit var redisTemplate: RedisTemplate<String, String>

    @MockK
    private lateinit var valueOps: ValueOperations<String, String>

    @MockK
    private lateinit var restTemplate: RestTemplate

    @MockK(relaxed = true)
    private lateinit var auditLogService: AuditLogService

    @MockK(relaxed = true)
    private lateinit var twoFactorService: TwoFactorService

    @MockK(relaxed = true)
    private lateinit var deviceService: DeviceService

    @MockK(relaxed = true)
    private lateinit var notifyCenterClient: NotifyCenterClient

    private val objectMapper = ObjectMapper()

    private val device = AuthService.DeviceContext(
        deviceKey = "test-device",
        deviceName = "JUnit",
        userAgent = "junit",
        ipAddress = "127.0.0.1",
    )

    @BeforeEach
    fun stubDeviceRegistration() {
        every { deviceService.register(any(), any(), any(), any(), any(), any()) } returns UserDevice(
            id = 1,
            userId = 1,
            deviceKey = "test-device",
            deviceName = "JUnit",
        )
    }

    private fun createService() = AuthService(
        userRepository, passwordEncoder, jwtUtil,
        redisTemplate, restTemplate, objectMapper,
        auditLogService, twoFactorService, deviceService, notifyCenterClient,
        "test-client-id", "test-client-secret", "test@test.local",
    )

    @Test
    fun `register should create user and return tokens`() {
        val request = RegisterRequest("test@example.com", "password123", "Test User")
        val mockUser = User(id = 1, email = request.email, passwordHash = "hashed", displayName = request.displayName)

        every { userRepository.existsByEmail(request.email) } returns false
        every { passwordEncoder.encode(request.password) } returns "hashed"
        every { userRepository.save(any()) } returns mockUser
        every { jwtUtil.generateAccessToken(1, request.email, any()) } returns "access-token"
        every { jwtUtil.generateRefreshToken(1, request.email, any()) } returns "refresh-token"

        val result = createService().register(request, device)

        assertEquals("access-token", result.accessToken)
        assertEquals("refresh-token", result.refreshToken)
        assertEquals(3600000, result.expiresIn)
    }

    @Test
    fun `register should throw when email already exists`() {
        val request = RegisterRequest("test@example.com", "password123", null)
        every { userRepository.existsByEmail(request.email) } returns true

        assertThrows<IllegalArgumentException> {
            createService().register(request, device)
        }
    }

    @Test
    fun `login should return tokens for valid credentials`() {
        val request = LoginRequest("test@example.com", "password123")
        val user = User(id = 1, email = request.email, passwordHash = "hashed")

        every { userRepository.findByEmail(request.email) } returns Optional.of(user)
        every { passwordEncoder.matches(request.password, user.passwordHash) } returns true
        every { jwtUtil.generateAccessToken(1, request.email, any()) } returns "access-token"
        every { jwtUtil.generateRefreshToken(1, request.email, any()) } returns "refresh-token"

        val result = createService().login(request, device)

        assertEquals("access-token", result.accessToken)
    }

    @Test
    fun `login should create a local account for an unknown email`() {
        val request = LoginRequest("new@example.com", "password123")
        val newUser = User(id = 3, email = request.email, passwordHash = "hashed", authProvider = "local")

        every { userRepository.findByEmail(request.email) } returns Optional.empty()
        every { passwordEncoder.encode(request.password) } returns "hashed"
        every { userRepository.save(any()) } returns newUser
        every { jwtUtil.generateAccessToken(3, request.email, any()) } returns "access-token"
        every { jwtUtil.generateRefreshToken(3, request.email, any()) } returns "refresh-token"

        val result = createService().login(request, device)

        assertEquals("access-token", result.accessToken)
        assertEquals(true, result.isNewUser)
    }

    @Test
    fun `login should throw for wrong password`() {
        val user = User(id = 1, email = "test@example.com", passwordHash = "hashed")
        every { userRepository.findByEmail(user.email) } returns Optional.of(user)
        every { passwordEncoder.matches("wrong", user.passwordHash) } returns false

        assertThrows<IllegalArgumentException> {
            createService().login(LoginRequest(user.email, "wrong"), device)
        }
    }

    @Test
    fun `login should reject user without password (oauth user)`() {
        val user = User(id = 1, email = "gh@test.com", passwordHash = null, authProvider = "github")
        every { userRepository.findByEmail(user.email) } returns Optional.of(user)

        assertThrows<IllegalArgumentException> {
            createService().login(LoginRequest(user.email, "any"), device)
        }
    }

    @Test
    fun `email login should create user when not exists`() {
        val request = EmailLoginRequest("new@example.com", "123456")
        val mockUser = User(id = 2, email = request.email, authProvider = "email")

        every { redisTemplate.opsForValue() } returns valueOps
        every { valueOps.get("pr:email_code:new@example.com") } returns "123456"
        every { valueOps.getAndDelete(any()) } returns "123456"
        every { redisTemplate.delete(any<String>()) } returns true
        every { userRepository.findByEmail(request.email) } returns Optional.empty()
        every { userRepository.save(any()) } returns mockUser
        every { jwtUtil.generateAccessToken(2, request.email, any()) } returns "access-token"
        every { jwtUtil.generateRefreshToken(2, request.email, any()) } returns "refresh-token"

        val result = createService().emailCodeLogin(request, device)

        assertEquals("access-token", result.accessToken)
    }

    @Test
    fun `send code should store the code and hand it to the notify center`() {
        val email = "member@example.com"
        val user = User(id = 7, email = email, authProvider = "email")
        var storedCode: String? = null

        every { redisTemplate.opsForValue() } returns valueOps
        every { valueOps.setIfAbsent("pr:email_code_cooldown:$email", "1", any<Duration>()) } returns true
        every { valueOps.set("pr:email_code:$email", any<String>(), any<Duration>()) } answers {
            storedCode = secondArg<String>()
        }
        every { userRepository.findByEmail(email) } returns Optional.of(user)

        createService().sendEmailCode(SendCodeRequest(email))

        val code = storedCode ?: error("verification code was not written to Redis")
        assertEquals(6, code.length)
        verify {
            notifyCenterClient.notifyLoginCode(
                email = email,
                code = code,
                expiresMinutes = 5,
                userId = 7,
            )
        }
    }

    @Test
    fun `send code should skip while the cooldown is active`() {
        val email = "spam@example.com"
        every { redisTemplate.opsForValue() } returns valueOps
        every { valueOps.setIfAbsent("pr:email_code_cooldown:$email", "1", any<Duration>()) } returns false

        createService().sendEmailCode(SendCodeRequest(email))

        verify(exactly = 0) { valueOps.set(any<String>(), any<String>(), any<Duration>()) }
        verify(exactly = 0) { notifyCenterClient.notifyLoginCode(any(), any(), any(), any()) }
    }

    @Test
    fun `email login should reject invalid code`() {
        every { redisTemplate.opsForValue() } returns valueOps
        every { valueOps.get("pr:email_code:test@example.com") } returns "999999"

        assertThrows<IllegalArgumentException> {
            createService().emailCodeLogin(EmailLoginRequest("test@example.com", "123456"), device)
        }
    }

    @Test
    fun `login should be interrupted by a two-factor challenge when enabled`() {
        val request = LoginRequest("test@example.com", "password123")
        val user = User(id = 1, email = request.email, passwordHash = "hashed")

        every { userRepository.findByEmail(request.email) } returns Optional.of(user)
        every { passwordEncoder.matches(request.password, user.passwordHash) } returns true
        every { twoFactorService.isEnabled(1) } returns true
        every { deviceService.isTrusted(1, "test-device") } returns false
        every { jwtUtil.generateTwoFactorChallengeToken(1, request.email, "test-device") } returns "challenge"

        val result = createService().login(request, device)

        assertEquals(true, result.twoFactorRequired)
        assertEquals("challenge", result.challengeToken)
        assertEquals(null, result.accessToken)
    }

    @Test
    fun `trusted device should skip the two-factor challenge`() {
        val request = LoginRequest("test@example.com", "password123")
        val user = User(id = 1, email = request.email, passwordHash = "hashed")

        every { userRepository.findByEmail(request.email) } returns Optional.of(user)
        every { passwordEncoder.matches(request.password, user.passwordHash) } returns true
        every { twoFactorService.isEnabled(1) } returns true
        every { deviceService.isTrusted(1, "test-device") } returns true
        every { jwtUtil.generateAccessToken(1, request.email, "test-device") } returns "access-token"
        every { jwtUtil.generateRefreshToken(1, request.email, "test-device") } returns "refresh-token"

        val result = createService().login(request, device)

        assertEquals("access-token", result.accessToken)
        assertEquals(false, result.twoFactorRequired)
    }

    @Test
    fun `verify two-factor should reject a token that is not a challenge`() {
        val request = TwoFactorVerifyRequest(challengeToken = "access-token", code = "123456")
        every { jwtUtil.extractClaims("access-token") } returns io.jsonwebtoken.Jwts.claims().build()

        assertThrows<InvalidCredentialsException> {
            createService().verifyTwoFactor(request, device)
        }
    }

    @Test
    fun `verify two-factor should ask for a fresh login when the challenge expired`() {
        val request = TwoFactorVerifyRequest(challengeToken = "expired", code = "123456")
        every { jwtUtil.extractClaims("expired") } throws
            io.jsonwebtoken.ExpiredJwtException(null, null, "expired")

        assertThrows<InvalidCredentialsException> {
            createService().verifyTwoFactor(request, device)
        }

        // Nothing past the token parse may run: an expired challenge must not
        // reach the code check, let alone the user lookup.
        verify(exactly = 0) { twoFactorService.verifySecondFactor(any(), any(), any()) }
    }

    @Test
    fun `verify two-factor should issue tokens for a valid recovery code`() {
        val claims = io.jsonwebtoken.Jwts.claims()
            .subject("1")
            .add("email", "test@example.com")
            .add(JwtUtil.SCOPE_CLAIM, JwtUtil.SCOPE_TWO_FACTOR_CHALLENGE)
            .add(JwtUtil.DEVICE_CLAIM, "test-device")
            .build()
        val user = User(id = 1, email = "test@example.com", passwordHash = "hashed")

        every { jwtUtil.extractClaims("challenge") } returns claims
        every { userRepository.findById(1) } returns Optional.of(user)
        every { twoFactorService.requireEnabled(1) } returns
            org.paperreader.model.UserTwoFactor(userId = 1, secret = "SECRET", enabled = true)
        every { twoFactorService.verifySecondFactor(1, "SECRET", "654321") } returns true
        every { deviceService.register(1, "test-device", any(), any(), "127.0.0.1", true) } returns UserDevice(
            id = 2, userId = 1, deviceKey = "test-device", deviceName = "JUnit", trusted = true,
        )
        every { jwtUtil.generateAccessToken(1, user.email, "test-device") } returns "access-token"
        every { jwtUtil.generateRefreshToken(1, user.email, "test-device") } returns "refresh-token"

        val result = createService().verifyTwoFactor(
            TwoFactorVerifyRequest(challengeToken = "challenge", code = "654321", trustDevice = true),
            device,
        )

        assertEquals("access-token", result.accessToken)
        assertEquals(false, result.twoFactorRequired)
    }
}
