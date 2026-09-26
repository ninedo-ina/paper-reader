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
