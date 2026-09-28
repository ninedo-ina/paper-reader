package org.paperreader.exception

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.paperreader.dto.LoginRequest
import org.springframework.core.MethodParameter
import org.springframework.http.HttpStatus
import org.springframework.validation.BeanPropertyBindingResult
import org.springframework.validation.FieldError
import org.springframework.web.bind.MethodArgumentNotValidException

class GlobalExceptionHandlerTest {

    private val handler = GlobalExceptionHandler()

    @Suppress("unused")
    private class Target {
        fun handle(request: LoginRequest) = request
    }

    private fun validationException(vararg errors: FieldError): MethodArgumentNotValidException {
        val binding = BeanPropertyBindingResult(LoginRequest("x", "y"), "loginRequest")
        errors.forEach(binding::addError)
        val parameter = MethodParameter(
            Target::class.java.getDeclaredMethod("handle", LoginRequest::class.java),
            0,
        )
        return MethodArgumentNotValidException(parameter, binding)
    }

    @Test
    fun `a field error becomes 400 with code 1003`() {
        val response = handler.handleValidation(
            validationException(FieldError("loginRequest", "email", "邮箱格式不正确")),
        )

        // 不接住的话会落到 catch-all 变成 500/9999——测试挡住的就是这个
        assertEquals(HttpStatus.BAD_REQUEST, response.statusCode)
        assertEquals(1003, response.body?.code)
        assertEquals("邮箱格式不正确", response.body?.message)
    }

    @Test
    fun `only the first field error is reported`() {
        val response = handler.handleValidation(
            validationException(
                FieldError("loginRequest", "email", "邮箱格式不正确"),
                FieldError("loginRequest", "password", "密码不能为空"),
            ),
        )

        assertEquals("邮箱格式不正确", response.body?.message)
    }

    @Test
    fun `an empty binding result still answers 400`() {
        val response = handler.handleValidation(validationException())

        assertEquals(HttpStatus.BAD_REQUEST, response.statusCode)
        assertEquals(1003, response.body?.code)
    }
}
