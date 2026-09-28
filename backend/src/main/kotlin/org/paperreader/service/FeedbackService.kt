package org.paperreader.service

import com.fasterxml.jackson.databind.ObjectMapper
import org.paperreader.dto.FeedbackDto
import org.paperreader.exception.FileTooLargeException
import org.paperreader.exception.InvalidParameterException
import org.paperreader.model.Feedback
import org.paperreader.repository.FeedbackRepository
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile
import java.util.UUID

/**
 * 公测期的问题反馈。入库（pr_feedbacks）+ 截图落盘（本地磁盘或 dufs，随 STORAGE_TYPE）。
 *
 * 截图先整体校验再逐张落盘：常见失败（格式不对 / 张数超 / 单张超限）在写出任何字节之前就拒掉，
 * 不会留下半份截图。落盘成功后才插库；万一行插入失败，残留的也只是几张没人引用的图片。
 */
@Service
class FeedbackService(
    private val feedbackRepository: FeedbackRepository,
    private val fileStorageService: FileStorageService,
    private val objectMapper: ObjectMapper,
) {
    private val logger = LoggerFactory.getLogger(FeedbackService::class.java)

    companion object {
        const val MAX_TITLE_LENGTH = 200
        const val MAX_CONTENT_LENGTH = 5000
        const val MAX_SCREENSHOTS = 3
        const val MAX_SCREENSHOT_BYTES = 5L * 1024 * 1024

        /** 允许的截图类型。白名单同时决定落盘扩展名——不看客户端给的文件名后缀。 */
        val SCREENSHOT_TYPES = mapOf(
            "image/png" to "png",
            "image/jpeg" to "jpg",
            "image/webp" to "webp",
            "image/gif" to "gif",
        )

        private const val MAX_PAGE_PATH_LENGTH = 500
        private const val MAX_APP_VERSION_LENGTH = 50
        private const val MAX_USER_AGENT_LENGTH = 500
        private const val MAX_LOCALE_LENGTH = 20
        private const val MAX_FILE_NAME_LENGTH = 200
    }

    @Transactional
    fun submit(
        userId: Long,
        title: String,
        content: String,
        pagePath: String?,
        appVersion: String?,
        locale: String?,
        userAgent: String?,
        screenshots: List<MultipartFile>?,
    ): FeedbackDto {
        val cleanTitle = title.trim()
        val cleanContent = content.trim()
        if (cleanTitle.isEmpty()) throw InvalidParameterException("标题不能为空")
        if (cleanTitle.length > MAX_TITLE_LENGTH) {
            throw InvalidParameterException("标题最多 $MAX_TITLE_LENGTH 字")
        }
        if (cleanContent.isEmpty()) throw InvalidParameterException("内容不能为空")
        if (cleanContent.length > MAX_CONTENT_LENGTH) {
            throw InvalidParameterException("内容最多 $MAX_CONTENT_LENGTH 字")
        }

        // 空的 part（前端没选文件却带了这个字段）不算一张截图。
        val files = screenshots.orEmpty().filter { !it.isEmpty }
        if (files.size > MAX_SCREENSHOTS) {
            throw InvalidParameterException("最多上传 $MAX_SCREENSHOTS 张截图")
        }
        files.forEach { validateScreenshot(it) }

        val metas = files.map { file ->
            val extension = SCREENSHOT_TYPES.getValue(file.contentType!!)
            val path = fileStorageService.storeBytes(
                "feedback/$userId/${UUID.randomUUID()}.$extension",
                file.bytes,
            )
            ScreenshotMeta(
                name = file.originalFilename.orEmpty().take(MAX_FILE_NAME_LENGTH),
                path = path,
                size = file.size,
                mime = file.contentType!!,
            )
        }

        val saved = feedbackRepository.save(
            Feedback(
                userId = userId,
                title = cleanTitle,
                content = cleanContent,
                pagePath = pagePath?.take(MAX_PAGE_PATH_LENGTH),
                appVersion = appVersion?.take(MAX_APP_VERSION_LENGTH),
                userAgent = userAgent?.take(MAX_USER_AGENT_LENGTH),
                locale = locale?.take(MAX_LOCALE_LENGTH),
                screenshots = if (metas.isEmpty()) null else objectMapper.writeValueAsString(metas),
            ),
        )
        logger.info("Feedback #{} from user {} with {} screenshot(s)", saved.id, userId, metas.size)
        return FeedbackDto(id = saved.id, screenshotCount = metas.size)
    }

    private fun validateScreenshot(file: MultipartFile) {
        val contentType = file.contentType
        if (contentType == null || contentType !in SCREENSHOT_TYPES) {
            throw InvalidParameterException("截图只支持 PNG/JPEG/WebP/GIF，当前是 ${contentType ?: "未知格式"}")
        }
        if (file.size > MAX_SCREENSHOT_BYTES) {
            // 与论文上传同码同义（1009/413）：这一个文件本身太大，原样重试一定还失败。
            throw FileTooLargeException(file.size, MAX_SCREENSHOT_BYTES)
        }
    }

    /** 截图元数据，序列化进 pr_feedbacks.screenshots。图片字节在磁盘上，这里只存索引。 */
    private data class ScreenshotMeta(
        val name: String,
        val path: String,
        val size: Long,
        val mime: String,
    )
}
