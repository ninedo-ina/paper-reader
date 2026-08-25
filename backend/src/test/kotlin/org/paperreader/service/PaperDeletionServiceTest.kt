package org.paperreader.service

import io.mockk.every
import io.mockk.impl.annotations.MockK
import io.mockk.junit5.MockKExtension
import io.mockk.verify
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.paperreader.exception.ResourceNotFoundException
import org.paperreader.exception.StorageOperationException
import org.paperreader.model.AiChat
import org.paperreader.model.Annotation
import org.paperreader.model.Paper
import org.paperreader.repository.AiChatRepository
import org.paperreader.repository.AiMessageRepository
import org.paperreader.repository.AnnotationCommentRepository
import org.paperreader.repository.AnnotationRepository
import org.paperreader.repository.NoteRepository
import org.paperreader.repository.PaperChunkRepository
import org.paperreader.repository.PaperRepository
import org.paperreader.repository.PaperTagRepository
import org.paperreader.repository.PaperVersionRepository
import org.paperreader.repository.ReadingLogRepository

@ExtendWith(MockKExtension::class)
class PaperDeletionServiceTest {
    @MockK(relaxed = true)
    private lateinit var paperRepository: PaperRepository

    @MockK(relaxed = true)
    private lateinit var annotationRepository: AnnotationRepository

    @MockK(relaxed = true)
    private lateinit var annotationCommentRepository: AnnotationCommentRepository

    @MockK(relaxed = true)
    private lateinit var noteRepository: NoteRepository

    @MockK(relaxed = true)
    private lateinit var readingLogRepository: ReadingLogRepository

    @MockK(relaxed = true)
    private lateinit var paperVersionRepository: PaperVersionRepository

    @MockK(relaxed = true)
    private lateinit var paperTagRepository: PaperTagRepository

    @MockK(relaxed = true)
    private lateinit var paperChunkRepository: PaperChunkRepository

    @MockK(relaxed = true)
    private lateinit var aiChatRepository: AiChatRepository

    @MockK(relaxed = true)
    private lateinit var aiMessageRepository: AiMessageRepository

    @MockK(relaxed = true)
    private lateinit var fileStorageService: FileStorageService

    @MockK(relaxed = true)
    private lateinit var auditLogService: AuditLogService

    private val service by lazy {
        PaperDeletionService(
            paperRepository,
            annotationRepository,
            annotationCommentRepository,
            noteRepository,
            readingLogRepository,
            paperVersionRepository,
            paperTagRepository,
            paperChunkRepository,
            aiChatRepository,
            aiMessageRepository,
            fileStorageService,
            auditLogService,
        )
    }

    private val paper = Paper(
        id = 7,
        userId = 42,
        title = "Deletion Test",
        sourceType = "UPLOAD",
        filePath = "42/7/original.pdf",
    )

    @Test
    fun `deletes the record and related data while retaining the original file`() {
        every { paperRepository.findByIdAndUserId(7, 42) } returns paper
        every { aiChatRepository.findByPaperId(7) } returns listOf(
            AiChat(id = 9, userId = 42, paperId = 7, model = "test", title = "Chat"),
        )
        every { annotationRepository.findByPaperId(7) } returns listOf(
            Annotation(
                id = 11,
                userId = 42,
                paperId = 7,
                pageNumber = 1,
                type = "HIGHLIGHT",
                position = "{}",
            ),
        )

        service.deletePaper(7, 42, deleteFile = false)

        verify { aiMessageRepository.deleteByChatIdIn(listOf(9)) }
        verify { aiChatRepository.deleteByPaperId(7) }
        verify { annotationCommentRepository.deleteByAnnotationId(11) }
        verify { annotationRepository.deleteByPaperId(7) }
        verify { noteRepository.deleteByPaperId(7) }
        verify { readingLogRepository.deleteByPaperId(7) }
        verify { paperVersionRepository.deleteByPaperId(7) }
        verify { paperTagRepository.deleteByPaperId(7) }
        verify { paperChunkRepository.deleteByPaperId(7) }
        verify { paperRepository.delete(paper) }
        verify { paperRepository.flush() }
        verify(exactly = 0) { fileStorageService.delete(any()) }
    }

    @Test
    fun `physically deletes the original file when requested`() {
        every { paperRepository.findByIdAndUserId(7, 42) } returns paper
        every { aiChatRepository.findByPaperId(7) } returns emptyList()
        every { fileStorageService.delete("42/7/original.pdf") } returns true

        service.deletePaper(7, 42, deleteFile = true)

        verify { fileStorageService.delete("42/7/original.pdf") }
        verify { paperRepository.delete(paper) }
    }

    @Test
    fun `rejects another users paper before deleting data or files`() {
        every { paperRepository.findByIdAndUserId(7, 42) } returns null

        assertThrows<ResourceNotFoundException> {
            service.deletePaper(7, 42, deleteFile = true)
        }

        verify(exactly = 0) { paperRepository.delete(any()) }
        verify(exactly = 0) { fileStorageService.delete(any()) }
    }

    @Test
    fun `fails the transaction when physical file deletion fails`() {
        every { paperRepository.findByIdAndUserId(7, 42) } returns paper
        every { aiChatRepository.findByPaperId(7) } returns emptyList()
        every { fileStorageService.delete("42/7/original.pdf") } returns false

        assertThrows<StorageOperationException> {
            service.deletePaper(7, 42, deleteFile = true)
        }

        verify { paperRepository.flush() }
        verify { fileStorageService.delete("42/7/original.pdf") }
    }
}
