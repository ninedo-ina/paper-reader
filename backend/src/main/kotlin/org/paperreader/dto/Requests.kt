package org.paperreader.dto

import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.databind.JsonNode
import java.time.Instant

// ==== Paper ====
enum class PaperCategory {
    THESIS,       // 学位论文
    JOURNAL,      // 期刊/会议论文
    PREPRINT,     // 预印本
    COURSE,       // 课程论文/作业
    TECH_REPORT,  // 研究报告/技术报告
    PATENT        // 专利文献
}

enum class StorageType {
    GITHUB, GITEE, OSS, S3
}

data class PaperDto(
    val id: Long,
    val title: String,
    val authors: String?,
    val abstractText: String?,
    val doi: String?,
    val year: String?,
    val journal: String?,
    val category: String,
    val sourceType: String,
    val sourceUrl: String?,
    val filePath: String?,
    val pageCount: Int,
    val fileSize: Long,
    val createdAt: Instant,
    val updatedAt: Instant,
)

@JsonInclude(JsonInclude.Include.NON_NULL)
data class PaperListDto(
    val id: Long,
    val title: String,
    val authors: String?,
    val doi: String?,
    val year: String?,
    val journal: String?,
    val category: String,
    val sourceType: String,
    val hasOriginalFile: Boolean,
    val pageCount: Int,
    val favorite: Boolean = false,
    val tags: List<String> = emptyList(),
    val createdAt: Instant,
)

@JsonInclude(JsonInclude.Include.NON_NULL)
data class PaperDetailDto(
    val id: Long,
    val title: String,
    val authors: String?,
    val abstractText: String?,
    val participants: String?,
    val doi: String?,
    val year: String?,
    val journal: String?,
    val category: String,
    val extraFields: Map<String, Any?>?,
    val storageConfigId: Long?,
    val favorite: Boolean = false,
    val sourceType: String,
    val sourceUrl: String?,
    val hasOriginalFile: Boolean,
    val pageCount: Int,
    val fileSize: Long,
    val grobidResult: Map<String, Any?>?,
    val parseStatus: String = "NOT_APPLICABLE",
    val parseError: String? = null,
    val tags: List<String> = emptyList(),
    val createdAt: Instant,
    val updatedAt: Instant,
)

data class PaperContextRequest(
    val selectedText: String,
    val pageNumber: Int? = null,
)

data class PaperContextChunkDto(
    val id: Long,
    val sectionTitle: String?,
    val ordinal: Int,
    val content: String,
    val pageStart: Int?,
    val pageEnd: Int?,
)

data class PaperContextDto(
    val paperId: Long,
    val title: String,
    val authors: String?,
    val abstractText: String?,
    val parseStatus: String,
    val parseError: String?,
    val selectedText: String,
    val pageNumber: Int?,
    val chunks: List<PaperContextChunkDto>,
)

data class UploadFromUrlRequest(
    val url: String,
    val title: String? = null,
)

data class CreatePaperRequest(
    val title: String,
    val authors: String? = null,
    val participants: String? = null,
    val abstractText: String? = null,
    val category: String? = null,
    val extraFields: Map<String, Any?>? = null,
    val storageConfigId: Long? = null,
)

data class UpdatePaperRequest(
    val title: String? = null,
    val authors: String? = null,
    val participants: String? = null,
    val abstractText: String? = null,
    val category: String? = null,
    val extraFields: Map<String, Any?>? = null,
    val doi: String? = null,
    val year: String? = null,
    val journal: String? = null,
)

/**
 * 正文（REQ-202609-0257）。正文与 abstractText（摘要）是两件独立的事：
 * 摘要只走 PATCH /api/papers/{id}，正文只走 /api/papers/{id}/content。
 * contentJson 是权威内容（编辑器节点树，可无损还原），contentHtml 是由它派生的
 * 只读呈现（便于预览与导出，随时可重建）。
 */
data class PaperContentDto(
    val paperId: Long,
    val contentJson: JsonNode?,
    val contentHtml: String?,
    val contentVersion: Int,
    val updatedAt: Instant,
)

data class UpdatePaperContentRequest(
    val contentJson: JsonNode? = null,
    val contentHtml: String? = null,
    /**
     * 本次保存所基于的正文版本号（保存前读到的 contentVersion）。为 null 时不做冲突检查，
     * 兼容不关心并发的调用方；非 null 且与服务端当前版本不一致时，说明有别的会话已经写过，
     * 服务端拒绝这次「后写覆盖」并返回 409，让前端明确告知用户而不是静默盖掉别人的改动。
     */
    val baseVersion: Int? = null,
)

data class ToggleFavoriteRequest(
    val favorite: Boolean,
)

data class AddTagRequest(
    val tag: String,
)

data class PaperTagDto(
    val id: Long,
    val paperId: Long,
    val tag: String,
    val createdAt: Instant,
)

data class SharePaperResponse(
    val shareText: String,
)

data class SharePaperRequest(
    val description: String? = null,
)

/**
 * 上传额度状态（REQ-202609-0267）。上限字段是写死在服务端的固定值，前端据此提示，
 * 不要在前端另抄一份常量——否则两边一旦不同步，用户会看到"还有额度"却被拒。
 */
data class UploadQuotaDto(
    val fileLimitBytes: Long,
    val dailyLimitBytes: Long,
    val totalLimitBytes: Long,
    val dailyUsedBytes: Long,
    val totalUsedBytes: Long,
    val dailyRemainingBytes: Long,
    val totalRemainingBytes: Long,
)

// ==== Paper Version ====
data class CreateVersionRequest(
    val version: String,
    val remark: String? = null,
)

data class PaperVersionDto(
    val id: Long,
    val paperId: Long,
    val version: String,
    val remark: String?,
    val storagePushStatus: String,
    val createdAt: Instant,
)

// ==== Storage Config ====
data class StorageConfigDto(
    val id: Long,
    val name: String,
    val storageType: String,
    val config: Map<String, Any?>,
    val isDefault: Boolean,
    val createdAt: Instant,
)

data class CreateStorageConfigRequest(
    val name: String,
    val storageType: String,
    val config: Map<String, Any?>,
    val isDefault: Boolean = false,
)

data class UpdateStorageConfigRequest(
    val name: String? = null,
    val config: Map<String, Any?>? = null,
    val isDefault: Boolean? = null,
)

// ==== Annotation ====
data class AnnotationDto(
    val id: Long,
    val paperId: Long,
    val pageNumber: Int,
    val type: String,
    val color: String?,
    val position: Map<String, Any?>,
    val text: String?,
    val comment: String?,
    val quotedText: String? = null,
    val startOffset: Int? = null,
    val endOffset: Int? = null,
    val images: List<String>? = null,
    val commentCount: Int = 0,
    val createdAt: Instant,
    val updatedAt: Instant,
)

data class CreateAnnotationRequest(
    val paperId: Long,
    val pageNumber: Int,
    val type: String,
    val color: String? = null,
    val position: Map<String, Any?>,
    val text: String? = null,
    val comment: String? = null,
    val quotedText: String? = null,
    val startOffset: Int? = null,
    val endOffset: Int? = null,
    val images: List<String>? = null,
)

data class UpdateAnnotationRequest(
    val type: String? = null,
    val color: String? = null,
    val position: Map<String, Any?>? = null,
    val text: String? = null,
    val comment: String? = null,
    val quotedText: String? = null,
    val startOffset: Int? = null,
    val endOffset: Int? = null,
    val images: List<String>? = null,
)

// ==== Annotation Comment ====
data class AnnotationCommentDto(
    val id: Long,
    val annotationId: Long,
    val userId: Long,
    val content: String,
    val parentId: Long? = null,
    val createdAt: Instant,
)

data class CreateAnnotationCommentRequest(
    val content: String,
    val parentId: Long? = null,
)

// ==== Note ====
data class NoteDto(
    val id: Long,
    val paperId: Long,
    val title: String?,
    val content: String,
    val pageNumber: Int,
    val chapter: String?,
    val tags: List<String>?,
    val quotedText: String? = null,
    val startOffset: Int? = null,
    val endOffset: Int? = null,
    val images: List<String>? = null,
    val position: Map<String, Any?>? = null,
    val createdAt: Instant,
    val updatedAt: Instant,
)

data class CreateNoteRequest(
    val paperId: Long,
    val title: String? = null,
    val content: String,
    val pageNumber: Int = 0,
    val chapter: String? = null,
    val tags: List<String>? = null,
    val quotedText: String? = null,
    val startOffset: Int? = null,
    val endOffset: Int? = null,
    val images: List<String>? = null,
    val position: Map<String, Any?>? = null,
)

data class UpdateNoteRequest(
    val title: String? = null,
    val content: String? = null,
    val pageNumber: Int? = null,
    val chapter: String? = null,
    val tags: List<String>? = null,
    val quotedText: String? = null,
    val startOffset: Int? = null,
    val endOffset: Int? = null,
    val images: List<String>? = null,
    val position: Map<String, Any?>? = null,
)

// ==== ReadingLog ====
data class ReadingLogDto(
    val id: Long,
    val paperId: Long,
    val paperTitle: String?,
    val currentPage: Int,
    val totalPages: Int,
    val durationSeconds: Long,
    val createdAt: Instant,
)

data class CreateReadingLogRequest(
    val paperId: Long,
    val currentPage: Int,
    val totalPages: Int,
    val durationSeconds: Long = 0,
)

// ==== AI Chat ====
data class AiChatListDto(
    val id: Long,
    val paperId: Long?,
    val model: String,
    val title: String,
    val createdAt: Instant,
)

data class AiMessageDto(
    val id: Long,
    val role: String,
    val content: String,
    val createdAt: Instant,
)

data class AiChatDetailDto(
    val id: Long,
    val paperId: Long?,
    val model: String,
    val title: String,
    val messages: List<AiMessageDto>,
    val createdAt: Instant,
)

data class CreateChatRequest(
    val paperId: Long? = null,
    val model: String,
    val title: String,
    val message: String? = null,
)

data class ChatRequest(
    val message: String,
)

// ==== User Settings ====
data class UserSettingsDto(
    val theme: String,
    val language: String,
    val defaultAiModel: String?,
)

data class UpdateUserSettingsRequest(
    val theme: String? = null,
    val language: String? = null,
    val defaultAiModel: String? = null,
)

// ==== File ====
data class FileInfoDto(
    val fileName: String,
    val filePath: String,
    val fileSize: Long,
    val pageCount: Int?,
)
