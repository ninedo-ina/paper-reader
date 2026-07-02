package org.paperreader.service

import io.mockk.every
import io.mockk.impl.annotations.MockK
import io.mockk.junit5.MockKExtension
import io.mockk.verify
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.paperreader.dto.LoginRequest
import org.paperreader.dto.RegisterRequest
import org.paperreader.model.User
import org.paperreader.repository.UserRepository
import org.paperreader.security.JwtUtil
import org.springframework.security.crypto.password.PasswordEncoder
import java.util.*
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue

@ExtendWith(MockKExtension::class)
class AuthServiceTest {

    @MockK
    private lateinit var userRepository: UserRepository

    @MockK
    private lateinit var passwordEncoder: PasswordEncoder

    @MockK
    private lateinit var jwtUtil: JwtUtil

    private fun createService() = AuthService(userRepository, passwordEncoder, jwtUtil)

    @Test
    fun `register should create user and return tokens`() {
        val request = RegisterRequest("test@example.com", "password123", "Test User")
        val mockUser = User(id = 1, email = request.email, passwordHash = "hashed", displayName = request.displayName)

        every { userRepository.existsByEmail(request.email) } returns false
        every { passwordEncoder.encode(request.password) } returns "hashed"
        every { userRepository.save(any()) } returns mockUser
        every { jwtUtil.generateAccessToken(1, request.email) } returns "access-token"
        every { jwtUtil.generateRefreshToken(1, request.email) } returns "refresh-token"

        val result = createService().register(request)

        assertEquals("access-token", result.accessToken)
        assertEquals("refresh-token", result.refreshToken)
        assertEquals(3600000, result.expiresIn)
    }

    @Test
    fun `register should throw when email already exists`() {
        val request = RegisterRequest("test@example.com", "password123", null)
        every { userRepository.existsByEmail(request.email) } returns true

        assertThrows<IllegalArgumentException> {
            createService().register(request)
        }
    }

    @Test
    fun `login should return tokens for valid credentials`() {
        val request = LoginRequest("test@example.com", "password123")
        val user = User(id = 1, email = request.email, passwordHash = "hashed")

        every { userRepository.findByEmail(request.email) } returns Optional.of(user)
        every { passwordEncoder.matches(request.password, user.passwordHash) } returns true
        every { jwtUtil.generateAccessToken(1, request.email) } returns "access-token"
        every { jwtUtil.generateRefreshToken(1, request.email) } returns "refresh-token"

        val result = createService().login(request)

        assertEquals("access-token", result.accessToken)
    }

    @Test
    fun `login should throw for invalid email`() {
        every { userRepository.findByEmail("bad@example.com") } returns Optional.empty()

        assertThrows<IllegalArgumentException> {
            createService().login(LoginRequest("bad@example.com", "pass"))
        }
    }

    @Test
    fun `login should throw for wrong password`() {
        val user = User(id = 1, email = "test@example.com", passwordHash = "hashed")
        every { userRepository.findByEmail(user.email) } returns Optional.of(user)
        every { passwordEncoder.matches("wrong", user.passwordHash) } returns false

        assertThrows<IllegalArgumentException> {
            createService().login(LoginRequest(user.email, "wrong"))
        }
    }
}
