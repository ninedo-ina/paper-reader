package org.paperreader.service

import org.paperreader.dto.*
import org.paperreader.exception.ResourceNotFoundException
import org.paperreader.model.Note
import org.paperreader.repository.NoteRepository
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Service
class NoteService(
    private val noteRepository: NoteRepository,
    private val auditLogService: AuditLogService,
) {
    @Transactional
    fun create(request: CreateNoteRequest, userId: Long): NoteDto {
        val result = noteRepository.save(
            Note(
                userId = userId,
                paperId = request.paperId,
                title = request.title,
                content = request.content,
                pageNumber = request.pageNumber,
                chapter = request.chapter,
                tags = request.tags?.joinToString(","),
            )
        ).toDto()
        val event = if (request.pageNumber > 0) "批注" else "笔记"
        auditLogService.log(userId, event, result.title ?: "Untitled")
        return result
    }

    @Transactional
    fun update(id: Long, request: UpdateNoteRequest, userId: Long): NoteDto {
        val note = noteRepository.findById(id)
            .orElseThrow { ResourceNotFoundException("Note", id) }
        require(note.userId == userId) { "Not your note" }

        val updated = note.copy(
            title = request.title ?: note.title,
            content = request.content ?: note.content,
            pageNumber = request.pageNumber ?: note.pageNumber,
            chapter = request.chapter ?: note.chapter,
            tags = request.tags?.joinToString(",") ?: note.tags,
            updatedAt = Instant.now(),
        )
        val result = noteRepository.save(updated).toDto()
        auditLogService.log(userId, "笔记", result.title ?: "Untitled")
        return result
    }

    fun listByPaper(paperId: Long, userId: Long): List<NoteDto> =
        noteRepository.findByPaperIdAndUserId(paperId, userId).map { it.toDto() }

    fun listAll(userId: Long, page: Int, pageSize: Int): PageResponse<NoteDto> {
        val pageRequest = PageRequest.of(page, pageSize)
        val result = noteRepository.findByUserIdOrderByCreatedAtDesc(userId, pageRequest)
        return PageResponse(
            items = result.content.map { it.toDto() },
            total = result.totalElements,
            page = page,
            pageSize = pageSize,
        )
    }

    @Transactional
    fun delete(id: Long, userId: Long) {
        val note = noteRepository.findById(id)
            .orElseThrow { ResourceNotFoundException("Note", id) }
        require(note.userId == userId) { "Not your note" }
        noteRepository.delete(note)
    }

    private fun Note.toDto() = NoteDto(
        id = id, paperId = paperId, title = title,
        content = content, pageNumber = pageNumber,
        chapter = chapter, tags = tags?.split(",")?.map { it.trim() }?.filter { it.isNotEmpty() },
        createdAt = createdAt, updatedAt = updatedAt,
    )
}
