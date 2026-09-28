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

/**
 * 请求的导出格式所需的引擎（pandoc / typst）在服务端不可用（未安装或不可执行）。
 * 用 503 表示这是服务端能力缺失，不是客户端参数错误；前端应先查 capabilities 接口禁用对应格式。
 * 注：1009/1010 已被上传限额（REQ-202609-0267）占用，本轮导出错误码顺延至 1011 起。
 */
class ExportUnavailableException(message: String) : BusinessException(1011, message, 503)

/**
 * 并发导出已达上限（app.export.max-concurrency）。导出引擎是独立进程、吃 CPU/内存，
 * 必须有并发闸门，否则可被用户触发资源耗尽。用 429 让前端稍后重试。
 */
class ExportBusyException(message: String = "导出服务繁忙，请稍后重试") :
    BusinessException(1012, message, 429)

/**
 * 导出引擎实际执行失败（非零退出 / 超时 / 产物为空）。对外只给通用文案，
 * 具体 stderr、路径、堆栈只落服务端日志，不回显给客户端（错误脱敏，见风险条款）。
 */
class ExportFailedException(message: String = "导出失败，请稍后重试") :
    BusinessException(1013, message, 502)

/**
 * 正文（contentJson / contentHtml）超过单篇体积上限（app.content.*）。
 *
 * 与 1009 上传超限同义、同用 413：这次提交的内容本身太大，原样重试一定还是失败，
 * 所以前端拿到 1014 必须停止自动保存重试，提示用户精简或拆分（见 useAutosave 的可重试判定）。
 * 1009/1010 上传限额、1011-1013 导出已占用，正文闸门顺延至 1014。
 */
class ContentTooLargeException(val actualBytes: Long, val limitBytes: Long, field: String) :
    BusinessException(
        1014,
        "$field 大小 ${formatBytes(actualBytes)} 超过单篇上限 ${formatBytes(limitBytes)}",
        413,
    )

/**
 * 只读分享 token 无效（不存在 / 已撤销 / 已过期）。W7，见 V20__collaboration.sql。
 * 统一用 404 而不区分「不存在」和「已失效」，避免泄露某篇论文是否存在或曾被分享过。
 * 注：1014 已被正文体积闸门（REQ-202609-0265 / W9）占用，本轮分享错误码顺延至 1015。
 */
class ShareLinkInvalidException : BusinessException(1015, "分享链接无效或已失效", 404)

/**
 * 同一来源在时间窗口内打登录 / 注册 / 发码接口太多次（见 AuthRateLimiter）。
 * 用 429 而不是 403：窗口一过就能重试。1015 已被分享链接占用（W7），本轮顺延至 1016，
 * 前端把它映射成 errors.tooManyRequests——与同样 429 的 1010/1012 文案不同，别合并。
 */
class RateLimitedException : BusinessException(1016, "操作过于频繁，请稍后再试", 429)
