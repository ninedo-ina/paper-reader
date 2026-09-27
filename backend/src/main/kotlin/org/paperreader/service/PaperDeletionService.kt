package org.paperreader.service

import org.paperreader.config.ExportProperties
import org.paperreader.exception.ResourceNotFoundException
import org.paperreader.exception.StorageOperationException
import org.paperreader.repository.AiChatRepository
import org.paperreader.repository.AiMessageRepository
import org.paperreader.repository.AnnotationCommentRepository
import org.paperreader.repository.AnnotationRepository
import org.paperreader.repository.NoteRepository
import org.paperreader.repository.PaperChunkRepository
import org.paperreader.repository.PaperContentVersionRepository
import org.paperreader.repository.PaperExportArtifactRepository
import org.paperreader.repository.PaperRepository
import org.paperreader.repository.PaperTagRepository
import org.paperreader.repository.PaperVersionRepository
import org.paperreader.repository.ReadingLogRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.nio.file.Path

@Service
class PaperDeletionService(
    private val paperRepository: PaperRepository,
    private val annotationRepository: AnnotationRepository,
    private val annotationCommentRepository: AnnotationCommentRepository,
    private val noteRepository: NoteRepository,
    private val readingLogRepository: ReadingLogRepository,
    private val paperVersionRepository: PaperVersionRepository,
    private val paperContentVersionRepository: PaperContentVersionRepository,
    private val paperTagRepository: PaperTagRepository,
    private val paperChunkRepository: PaperChunkRepository,
    private val paperExportArtifactRepository: PaperExportArtifactRepository,
    private val aiChatRepository: AiChatRepository,
    private val aiMessageRepository: AiMessageRepository,
    private val fileStorageService: FileStorageService,
    private val auditLogService: AuditLogService,
    private val exportProperties: ExportProperties,
) {
    @Transactional
    fun deletePaper(id: Long, userId: Long, deleteFile: Boolean) {
        val paper = paperRepository.findByIdAndUserId(id, userId)
            ?: throw ResourceNotFoundException("Paper", id)

        val chatIds = aiChatRepository.findByPaperId(paper.id).map { it.id }
        if (chatIds.isNotEmpty()) {
            aiMessageRepository.deleteByChatIdIn(chatIds)
            aiChatRepository.deleteByPaperId(paper.id)
        }

        annotationRepository.findByPaperId(paper.id).forEach { annotation ->
            annotationCommentRepository.deleteByAnnotationId(annotation.id)
        }
        annotationRepository.deleteByPaperId(paper.id)
        noteRepository.deleteByPaperId(paper.id)
        readingLogRepository.deleteByPaperId(paper.id)
        paperVersionRepository.deleteByPaperId(paper.id)
        paperContentVersionRepository.deleteByPaperId(paper.id)
        paperTagRepository.deleteByPaperId(paper.id)
        paperChunkRepository.deleteByPaperId(paper.id)

        // 导出产物（W5）：产物文件落在 {export-root}/{paperId}/ 下，随论文一起清干净，再删登记行。
        runCatching {
            Path.of(exportProperties.outputDir).toAbsolutePath().normalize()
                .resolve(paper.id.toString()).toFile().deleteRecursively()
        }
        paperExportArtifactRepository.deleteByPaperId(paper.id)

        // 正文（content_json / content_html）是 pr_papers 的列，随本行一起删除，无需单独清理。
        paperRepository.delete(paper)
        auditLogService.log(
            userId,
            if (deleteFile) "删除论文及原文件" else "删除论文",
            paper.title.take(255),
        )

        // Validate all database constraints before the irreversible file operation.
        paperRepository.flush()

        val filePath = paper.filePath?.takeIf { it.isNotBlank() }
        if (deleteFile && filePath != null && !fileStorageService.delete(filePath)) {
            throw StorageOperationException("Stored paper file could not be deleted; the paper record was kept")
        }
    }
}
