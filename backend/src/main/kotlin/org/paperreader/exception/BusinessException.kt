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
