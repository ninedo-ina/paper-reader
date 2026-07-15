package org.paperreader.service

import com.fasterxml.jackson.databind.ObjectMapper
import org.paperreader.dto.AnnotationCommentDto
import org.paperreader.dto.AnnotationDto
import org.paperreader.dto.CreateAnnotationCommentRequest
import org.paperreader.dto.CreateAnnotationRequest
import org.paperreader.dto.UpdateAnnotationRequest
import org.paperreader.exception.InvalidParameterException
import org.paperreader.exception.ResourceNotFoundException
import org.paperreader.model.Annotation
import org.paperreader.model.AnnotationComment
import org.paperreader.repository.AnnotationCommentRepository
import org.paperreader.repository.AnnotationRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Service
class AnnotationService(
    private val annotationRepository: AnnotationRepository,
    private val commentRepository: AnnotationCommentRepository,
    private val objectMapper: ObjectMapper,
) {
    companion object {
        val VALID_TYPES = setOf("HIGHLIGHT", "UNDERLINE", "STRIKETHROUGH", "NOTE", "AREA")
    }

    @Transactional
    fun create(request: CreateAnnotationRequest, userId: Long): AnnotationDto {
        require(request.type in VALID_TYPES) { "Invalid annotation type: ${request.type}" }
        return annotationRepository.save(
            Annotation(
                userId = userId,
                paperId = request.paperId,
                pageNumber = request.pageNumber,
                type = request.type,
                color = request.color,
                position = objectMapper.writeValueAsString(request.position),
                text = request.text,
                comment = request.comment,
                quotedText = request.quotedText,
                startOffset = request.startOffset,
                endOffset = request.endOffset,
                images = request.images?.let { objectMapper.writeValueAsString(it) },
            )
        ).toDto()
    }

    @Transactional
    fun update(id: Long, request: UpdateAnnotationRequest, userId: Long): AnnotationDto {
        val annotation = annotationRepository.findById(id)
            .orElseThrow { ResourceNotFoundException("Annotation", id) }
        require(annotation.userId == userId) { "Not your annotation" }

        request.type?.let { require(it in VALID_TYPES) { "Invalid type: $it" } }

        val updated = annotation.copy(
            type = request.type ?: annotation.type,
            color = request.color ?: annotation.color,
            position = request.position?.let { objectMapper.writeValueAsString(it) } ?: annotation.position,
            text = request.text ?: annotation.text,
            comment = request.comment ?: annotation.comment,
            quotedText = request.quotedText ?: annotation.quotedText,
            startOffset = request.startOffset ?: annotation.startOffset,
            endOffset = request.endOffset ?: annotation.endOffset,
            images = request.images?.let { objectMapper.writeValueAsString(it) } ?: annotation.images,
            updatedAt = Instant.now(),
        )
        return annotationRepository.save(updated).toDto()
    }

    fun listByPaper(paperId: Long, userId: Long): List<AnnotationDto> =
        annotationRepository.findByPaperIdAndUserId(paperId, userId).map { it.toDto() }

    @Transactional
    fun delete(id: Long, userId: Long) {
        val annotation = annotationRepository.findById(id)
            .orElseThrow { ResourceNotFoundException("Annotation", id) }
        require(annotation.userId == userId) { "Not your annotation" }
        commentRepository.deleteByAnnotationId(id)
        annotationRepository.delete(annotation)
    }

    // ==== Comments ====

    @Transactional
    fun addComment(annotationId: Long, request: CreateAnnotationCommentRequest, userId: Long): AnnotationCommentDto {
        annotationRepository.findById(annotationId)
            .orElseThrow { ResourceNotFoundException("Annotation", annotationId) }
        return commentRepository.save(
            AnnotationComment(
                annotationId = annotationId,
                userId = userId,
                content = request.content,
                parentId = request.parentId,
            )
        ).toDto()
    }

    fun listComments(annotationId: Long): List<AnnotationCommentDto> =
        commentRepository.findByAnnotationIdOrderByCreatedAtAsc(annotationId).map { it.toDto() }

    @Transactional
    fun deleteComment(commentId: Long, userId: Long) {
        val comment = commentRepository.findById(commentId)
            .orElseThrow { ResourceNotFoundException("AnnotationComment", commentId) }
        require(comment.userId == userId) { "Not your comment" }
        commentRepository.delete(comment)
    }

    @Suppress("UNCHECKED_CAST")
    private fun Annotation.toDto(): AnnotationDto {
        return AnnotationDto(
            id = id, paperId = paperId, pageNumber = pageNumber,
            type = type, color = color,
            position = objectMapper.readValue(position, Map::class.java) as Map<String, Any?>,
            text = text, comment = comment,
            quotedText = quotedText,
            startOffset = startOffset,
            endOffset = endOffset,
            images = images?.let { objectMapper.readValue(it, List::class.java) as? List<String> },
            commentCount = commentRepository.countByAnnotationId(id),
            createdAt = createdAt, updatedAt = updatedAt,
        )
    }

    private fun AnnotationComment.toDto() = AnnotationCommentDto(
        id = id, annotationId = annotationId, userId = userId,
        content = content, parentId = parentId, createdAt = createdAt,
    )
}
