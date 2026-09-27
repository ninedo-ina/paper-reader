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

// ==== Paper Export / Import (W5) ====
data class CreateExportRequest(
    /** markdown / html / latex / bibtex / docx / pdf */
    val format: String,
    /** 关联的发布版本；为空表示导出当前草稿正文。 */
    val versionId: Long? = null,
)

data class ExportArtifactDto(
    val id: Long,
    val paperId: Long,
    val versionId: Long?,
    val format: String,
    val engine: String?,
    val byteSize: Long?,
    val contentVersion: Int?,
    val status: String,
    /** 二次下载地址（相对 API 前缀）。 */
    val downloadUrl: String,
    val createdAt: Instant,
)

data class ExportFormatDto(
    val id: String,
    val ext: String,
    val available: Boolean,
)

data class ExportCapabilitiesDto(
    val formats: List<ExportFormatDto>,
    val importAvailable: Boolean,
)

data class ImportMarkdownRequest(
    val markdown: String,
)

data class ImportResultDto(
    val contentHtml: String,
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

// ==== Collaboration & Sharing (W7, REQ-202609-0263) ====

/**
 * Yjs 文档全量快照。服务端当不透明 base64 存储，不解析 CRDT。
 * [state] 为空表示这篇论文还没有任何协同状态（新加入者应据 [PaperContentDto] 播种）。
 */
data class CollabStateDto(
    val paperId: Long,
    val state: String?,
    val updatedAt: Instant?,
    /** 调用方在这篇论文里的角色：OWNER（作者）/ EDITOR / VIEWER。前端据此决定可写与可管理。 */
    val role: String = "VIEWER",
    /** 是否可写（作者或 EDITOR）；VIEWER / 导师为 false，只读 + 可批注。 */
    val canWrite: Boolean = false,
    /** 是否为论文作者：仅作者可播种既有正文、管理协作者与分享链接。 */
    val isOwner: Boolean = false,
)

/** 首次播种：谁先插入谁为准（seed-if-absent），并发落后者读回胜出者的状态。 */
data class SeedCollabStateRequest(
    val state: String,
)

/**
 * 防抖保存：整份 Yjs 快照按最后写入者覆盖（LWW，并发方经 Yjs 已收敛）。
 * 同时把派生的可读正文镜像回 pr_papers（[contentJson]/[contentHtml]），
 * 让列表 / 导出 / AI 上下文 / 只读分享这些非协同路径继续拿到最新正文。
 */
data class SaveCollabStateRequest(
    val state: String,
    val contentJson: JsonNode? = null,
    val contentHtml: String? = null,
)

/** 「与我协作」列表项：我是协作者（而非作者）的论文。 */
data class SharedPaperDto(
    val paperId: Long,
    val title: String,
    val role: String,
    val ownerId: Long,
    val ownerName: String?,
    val updatedAt: Instant,
)

/** 结构化协作者。[email]/[displayName] 便于前端展示，判权只看 [role]。 */
data class CollaboratorDto(
    val id: Long,
    val paperId: Long,
    val userId: Long,
    val email: String,
    val displayName: String?,
    val role: String,
    val createdAt: Instant,
)

data class AddCollaboratorRequest(
    val email: String,
    /** EDITOR 可读写协同；VIEWER 只读+可批注。 */
    val role: String = "EDITOR",
)

/** 编辑器正文里的批注。[authorName] 供展示，锚点失效时靠 [quote] 仍可读。 */
data class PaperCommentDto(
    val id: Long,
    val paperId: Long,
    val userId: Long,
    val authorName: String?,
    val anchor: String?,
    val quote: String?,
    val body: String,
    val resolved: Boolean,
    val createdAt: Instant,
    val updatedAt: Instant,
)

data class CreateCommentRequest(
    val anchor: String? = null,
    val quote: String? = null,
    val body: String,
)

data class UpdateCommentRequest(
    val body: String? = null,
    val resolved: Boolean? = null,
)

/**
 * 只读分享链接。[token] 供拼 URL（前端加 origin + /share/{token}）；本轮 role 恒为 VIEWER。
 * 已撤销 / 已过期的链接仍会在作者的列表里出现，供其查看历史，但公开解析会 404。
 */
data class ShareLinkDto(
    val id: Long,
    val paperId: Long,
    val token: String,
    val role: String,
    val expiresAt: Instant?,
    val revoked: Boolean,
    val createdAt: Instant,
)

data class CreateShareRequest(
    /** 有效天数；为空 = 永不过期。 */
    val expiresInDays: Long? = null,
)

/**
 * 免登录读取的只读正文（W7 只读分享）。凭有效 token 返回，内容取自 pr_papers 镜像的最新正文。
 * 不含任何身份 / 权限信息，纯展示。
 */
data class PublicSharePaperDto(
    val paperId: Long,
    val title: String,
    val authors: String?,
    val participants: String?,
    val abstractText: String?,
    val contentHtml: String?,
    val contentJson: JsonNode?,
    val updatedAt: Instant,
)
