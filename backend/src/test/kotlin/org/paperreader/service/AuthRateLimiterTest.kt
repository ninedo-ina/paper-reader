package org.paperreader.service

import io.mockk.every
import io.mockk.impl.annotations.MockK
import io.mockk.junit5.MockKExtension
import io.mockk.verify
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.paperreader.exception.RateLimitedException
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.data.redis.core.ValueOperations
import java.time.Duration

@ExtendWith(MockKExtension::class)
class AuthRateLimiterTest {

    @MockK
    private lateinit var redisTemplate: RedisTemplate<String, String>

    @MockK(relaxed = true)
    private lateinit var valueOps: ValueOperations<String, String>

    private val limiter: AuthRateLimiter
        get() = AuthRateLimiter(redisTemplate).also { every { redisTemplate.opsForValue() } returns valueOps }

    private fun key(kind: AuthRateLimiter.Kind, ip: String) =
        "pr:auth_rate_limit:${kind.name.lowercase()}:$ip"

    @Test
    fun `every hit arms the window with the counter`() {
        every { valueOps.increment(key(AuthRateLimiter.Kind.LOGIN, "1.2.3.4")) } returns 1L

        limiter.check(AuthRateLimiter.Kind.LOGIN, "1.2.3.4")

        // TTL 必须和计数一起下发：先 INCR 再 EXPIRE，中间断一次这个 IP 就永久被封了
        verify {
            valueOps.setIfAbsent(
                key(AuthRateLimiter.Kind.LOGIN, "1.2.3.4"),
                "0",
                AuthRateLimiter.Kind.LOGIN.window,
            )
        }
    }

    @Test
    fun `the last allowed hit passes`() {
        val limit = AuthRateLimiter.Kind.LOGIN.limit
        every { valueOps.increment(key(AuthRateLimiter.Kind.LOGIN, "1.2.3.4")) } returns limit.toLong()

        limiter.check(AuthRateLimiter.Kind.LOGIN, "1.2.3.4")
    }

    @Test
    fun `one hit past the limit is rejected`() {
        val limit = AuthRateLimiter.Kind.LOGIN.limit
        every { valueOps.increment(key(AuthRateLimiter.Kind.LOGIN, "1.2.3.4")) } returns (limit + 1).toLong()

        assertThrows<RateLimitedException> {
            limiter.check(AuthRateLimiter.Kind.LOGIN, "1.2.3.4")
        }
    }

    @Test
    fun `limits are counted per kind and per ip`() {
        every { valueOps.increment(key(AuthRateLimiter.Kind.SEND_CODE, "1.2.3.4")) } returns 1L

        limiter.check(AuthRateLimiter.Kind.SEND_CODE, "1.2.3.4")

        // 一个 IP 刷爆发码，不该连带把别的 IP 的登录额度也算掉
        verify { valueOps.increment(key(AuthRateLimiter.Kind.SEND_CODE, "1.2.3.4")) }
        verify(exactly = 0) { valueOps.increment(key(AuthRateLimiter.Kind.SEND_CODE, "5.6.7.8")) }
        verify(exactly = 0) { valueOps.increment(key(AuthRateLimiter.Kind.LOGIN, "1.2.3.4")) }
    }

    @Test
    fun `each kind carries its own window`() {
        every { valueOps.increment(key(AuthRateLimiter.Kind.REGISTER, "1.2.3.4")) } returns 1L

        limiter.check(AuthRateLimiter.Kind.REGISTER, "1.2.3.4")

        verify {
            valueOps.setIfAbsent(
                key(AuthRateLimiter.Kind.REGISTER, "1.2.3.4"),
                "0",
                Duration.ofHours(1),
            )
        }
    }

    @Test
    fun `a redis outage lets the request through instead of locking everyone out`() {
        every { valueOps.setIfAbsent(any(), any(), any<Duration>()) } throws
            RuntimeException("connection refused")

        // 不抛异常即通过：限流是加固，不该变成登录入口的单点故障
        limiter.check(AuthRateLimiter.Kind.LOGIN, "1.2.3.4")
    }
}
