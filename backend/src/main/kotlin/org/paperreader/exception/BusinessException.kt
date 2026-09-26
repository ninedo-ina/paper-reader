package org.paperreader.exception

open class BusinessException(
    val code: Int,
    override val message: String,
    val httpStatus: Int = 400,
) : RuntimeException(message)

class TokenExpiredException : BusinessException(1001, "Token expired", 401)
class PermissionDeniedException : BusinessException(1002, "Permission denied", 403)
class InvalidParameterException(message: String) : BusinessException(1003, message, 400)
class ResourceNotFoundException(resource: String, id: Any?) : BusinessException(
    1004, "${resource} not found${id?.let { ": $it" } ?: ""}", 404,
)
class StorageOperationException(message: String) : BusinessException(1005, message, 502)

/** Wrong password, wrong TOTP code, or an unusable recovery code. */
class InvalidCredentialsException(message: String) : BusinessException(1006, message, 400)

/** The second factor is required but was not (or could not be) presented. */
class TwoFactorRequiredException(message: String = "Two-factor authentication required") :
    BusinessException(1007, message, 401)

/**
 * 保存正文时，客户端所基于的版本号已落后于服务端当前版本——说明有别的会话已经写过。
 * 用 409 拒绝这次「后写覆盖」，`currentVersion` 让前端知道最新是第几版，可提示并重新加载。
 */
class ContentVersionConflictException(val currentVersion: Int) :
    BusinessException(1008, "内容已被其他会话更新", 409)

/** 单个文件超过单文件上限（当前 10MB）。413 让前端能区分「这一个文件太大」和「额度用完」。 */
class FileTooLargeException(val actualBytes: Long, val limitBytes: Long) :
    BusinessException(1009, "文件大小 ${formatBytes(actualBytes)} 超过单文件上限 ${formatBytes(limitBytes)}", 413)

/**
 * 上传额度已满：单用户单日、单用户累计、或全应用单日任一命中。
 * 429 而不是 403——额度是按时间窗口恢复的，重试（换天 / 清理后）有意义。
 */
class UploadQuotaExceededException(message: String) : BusinessException(1010, message, 429)

/** 把字节数写成 10MB / 1GB 这样可读的字符串，供上传限制的报错文案使用。 */
internal fun formatBytes(bytes: Long): String {
    val gb = bytes / 1024.0 / 1024.0 / 1024.0
    if (gb >= 1) return "${round1(gb)}GB"
    return "${round1(bytes / 1024.0 / 1024.0)}MB"
}

private fun round1(value: Double): String {
    val rounded = kotlin.math.round(value * 10) / 10
    return if (rounded == rounded.toLong().toDouble()) rounded.toLong().toString() else rounded.toString()
}
