package org.paperreader.exception

import org.paperreader.dto.ApiResponse
import org.paperreader.service.UploadQuotaService
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.multipart.MaxUploadSizeExceededException

@RestControllerAdvice
class GlobalExceptionHandler {

    private val logger = LoggerFactory.getLogger(GlobalExceptionHandler::class.java)

    @ExceptionHandler(BusinessException::class)
    fun handleBusiness(ex: BusinessException): ResponseEntity<ApiResponse<Nothing>> {
        logger.warn("Business error: [{}] {}", ex.code, ex.message)
        return ResponseEntity.status(ex.httpStatus)
            .body(ApiResponse(code = ex.code, message = ex.message))
    }

    /**
     * multipart 超过 max-file-size 时 Spring 在进 Controller 之前就抛了，走不到业务校验。
     * 这里翻成和业务侧同一个 1009/413，前端不必区分「被哪一层拦下的」。
     */
    @ExceptionHandler(MaxUploadSizeExceededException::class)
    fun handleMaxUploadSize(ex: MaxUploadSizeExceededException): ResponseEntity<ApiResponse<Nothing>> {
        logger.warn("Upload rejected by multipart limit: {}", ex.message)
        val limit = formatBytes(UploadQuotaService.MAX_FILE_BYTES)
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
            .body(ApiResponse(code = 1009, message = "文件大小超过单文件上限 $limit"))
    }

    /**
     * `@Valid` 在进 Controller 之前拦下的参数校验失败。本类没有继承
     * ResponseEntityExceptionHandler，不显式接住的话会落到下面的 catch-all 变成 500/9999。
     * 只回第一条错误：报错是给人看的，一次提示一条比堆一串更容易照做。
     */
    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handleValidation(ex: MethodArgumentNotValidException): ResponseEntity<ApiResponse<Nothing>> {
        val first = ex.bindingResult.fieldErrors.firstOrNull()
        val message = first?.defaultMessage ?: "Invalid argument"
        logger.warn("Validation failed: {} - {}", first?.field, message)
        return ResponseEntity.badRequest().body(ApiResponse(code = 1003, message = message))
    }

    @ExceptionHandler(IllegalArgumentException::class)
    fun handleIllegalArgument(ex: IllegalArgumentException): ResponseEntity<ApiResponse<Nothing>> {
        logger.warn("Invalid argument: {}", ex.message)
        return ResponseEntity.badRequest()
            .body(ApiResponse(code = 1003, message = ex.message ?: "Invalid argument"))
    }

    @ExceptionHandler(Exception::class)
    fun handleUnexpected(ex: Exception): ResponseEntity<ApiResponse<Nothing>> {
        logger.error("Unexpected error", ex)
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(ApiResponse(code = 9999, message = "Internal server error"))
    }
}
