package org.paperreader.dto

import jakarta.validation.ConstraintViolation
import jakarta.validation.Validation
import jakarta.validation.Validator
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/**
 * 直接拿真的 Validator 跑一遍 DTO，钉住 `@field:` 约束确实挂上去了。
 *
 * Kotlin 的 data class 构造参数默认落在构造器参数上，Jakarta 校验读的是字段/getter，
 * 少了 `@field:` 这些注解就是装饰——参数再离谱也照样进 Controller。这个测试的意义
 * 就是它一旦被漏掉就红。
 */
class AuthRequestValidationTest {

    private val validator: Validator = Validation.buildDefaultValidatorFactory().validator

    private fun messages(violations: Set<ConstraintViolation<*>>) = violations.map { it.message }

    private fun <T> assertRejected(bean: T, expectedMessage: String) {
        val violations = validator.validate(bean)
        assertTrue(expectedMessage in messages(violations)) {
            "expected '$expectedMessage', got ${messages(violations)}"
        }
    }

    private fun <T> assertAccepted(bean: T) {
        val violations = validator.validate(bean)
        assertEquals(emptyList<String>(), messages(violations))
    }

    @Test
    fun `a well-formed login request passes`() {
        assertAccepted(LoginRequest("member@example.com", "password123"))
    }

    @Test
    fun `login rejects a blank email`() {
        assertRejected(LoginRequest("", "password123"), "邮箱不能为空")
    }

    @Test
    fun `login rejects a malformed email`() {
        assertRejected(LoginRequest("not-an-email", "password123"), "邮箱格式不正确")
    }

    @Test
    fun `login rejects an email past the column limit`() {
        // 探测脚本正是拿这种超长串喂进来的：@Size 在这里挡住，别让它一路走到查库
        val long = "a".repeat(250) + "@example.com"
        assertRejected(LoginRequest(long, "password123"), "邮箱长度超出限制")
    }

    @Test
    fun `login accepts a 254-character email`() {
        // 254 是 @Size 的上界，也正是 RFC 5321 对地址的规定；再长一位就该被拒
        // 本地部分 64 位是 @Email 自己的上限，所以撑长度只能靠域名
        val boundary = "a".repeat(64) + "@" + "b".repeat(63) + "." + "c".repeat(63) + "." + "d".repeat(61)
        assertEquals(254, boundary.length)
        assertAccepted(LoginRequest(boundary, "password123"))
    }

    @Test
    fun `login rejects a blank password`() {
        assertRejected(LoginRequest("member@example.com", ""), "密码不能为空")
    }

    @Test
    fun `login rejects a password long enough to waste a bcrypt round`() {
        assertRejected(LoginRequest("member@example.com", "x".repeat(129)), "密码长度超出限制")
    }

    @Test
    fun `login keeps accepting short passwords so old accounts can still sign in`() {
        // 历史账号里有短密码，登录侧加下限会把它们锁在门外
        assertAccepted(LoginRequest("member@example.com", "abc"))
    }

    @Test
    fun `register enforces the 6-72 password range`() {
        assertRejected(
            RegisterRequest("member@example.com", "12345", null),
            "密码长度需为 6-72 位",
        )
        assertRejected(
            RegisterRequest("member@example.com", "x".repeat(73), null),
            "密码长度需为 6-72 位",
        )
        assertAccepted(RegisterRequest("member@example.com", "x".repeat(72), null))
    }

    @Test
    fun `register rejects a malformed email`() {
        assertRejected(RegisterRequest("nope", "password123", null), "邮箱格式不正确")
    }

    @Test
    fun `send code rejects a malformed email`() {
        assertRejected(SendCodeRequest(""), "邮箱不能为空")
        assertRejected(SendCodeRequest("nope@"), "邮箱格式不正确")
    }

    @Test
    fun `email login only accepts a six-digit code`() {
        assertRejected(EmailLoginRequest("member@example.com", "abcdef"), "验证码为 6 位数字")
        assertRejected(EmailLoginRequest("member@example.com", "12345"), "验证码为 6 位数字")
        assertAccepted(EmailLoginRequest("member@example.com", "012345"))
    }
}
