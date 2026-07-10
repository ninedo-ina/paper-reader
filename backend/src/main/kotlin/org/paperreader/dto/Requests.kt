package org.paperreader.dto

import com.fasterxml.jackson.annotation.JsonInclude
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
    val pageCount: Int,
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
    val sourceType: String,
    val sourceUrl: String?,
    val pageCount: Int,
    val fileSize: Long,
    val grobidResult: Map<String, Any?>?,
    val createdAt: Instant,
    val updatedAt: Instant,
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
    val createdAt: Instant,
    val updatedAt: Instant,
)

data class CreateAnnotationRequest(
    val paperId: Long,
    val pageNumber: Int,
    val type: String,
    val color: String? = null,
    val position: Map<String, Float>,
    val text: String? = null,
    val comment: String? = null,
)

data class UpdateAnnotationRequest(
    val type: String? = null,
    val color: String? = null,
    val position: Map<String, Float>? = null,
    val text: String? = null,
    val comment: String? = null,
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
)

data class UpdateNoteRequest(
    val title: String? = null,
    val content: String? = null,
    val pageNumber: Int? = null,
    val chapter: String? = null,
    val tags: List<String>? = null,
)

// ==== ReadingLog ====
data class ReadingLogDto(
    val id: Long,
    val paperId: Long,
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
