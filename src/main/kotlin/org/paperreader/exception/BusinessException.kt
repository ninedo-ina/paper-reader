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
