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

/**
 * 请求的导出格式所需的引擎（pandoc / typst）在服务端不可用（未安装或不可执行）。
 * 用 503 表示这是服务端能力缺失，不是客户端参数错误；前端应先查 capabilities 接口禁用对应格式。
 */
class ExportUnavailableException(message: String) : BusinessException(1009, message, 503)

/**
 * 并发导出已达上限（app.export.max-concurrency）。导出引擎是独立进程、吃 CPU/内存，
 * 必须有并发闸门，否则可被用户触发资源耗尽。用 429 让前端稍后重试。
 */
class ExportBusyException(message: String = "导出服务繁忙，请稍后重试") :
    BusinessException(1010, message, 429)

/**
 * 导出引擎实际执行失败（非零退出 / 超时 / 产物为空）。对外只给通用文案，
 * 具体 stderr、路径、堆栈只落服务端日志，不回显给客户端（错误脱敏，见风险条款）。
 */
class ExportFailedException(message: String = "导出失败，请稍后重试") :
    BusinessException(1011, message, 502)
