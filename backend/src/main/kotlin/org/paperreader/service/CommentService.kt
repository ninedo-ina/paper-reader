package org.paperreader.service

import org.paperreader.dto.CreateCommentRequest
import org.paperreader.dto.PaperCommentDto
import org.paperreader.dto.UpdateCommentRequest
import org.paperreader.exception.InvalidParameterException
import org.paperreader.exception.PermissionDeniedException
import org.paperreader.exception.ResourceNotFoundException
import org.paperreader.model.PaperComment
import org.paperreader.repository.PaperCommentRepository
import org.paperreader.repository.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

/**
 * 编辑器正文批注（W7）。导师改稿的核心：VIEWER（只读协作者 / 导师）也能批注，
 * 所以「新建批注」只要求可读；改正文才要求可写。
 */
@Service
class CommentService(
    private val accessService: PaperAccessService,
    private val commentRepository: PaperCommentRepository,
    private val userRepository: UserRepository,
) {
    @Transactional(readOnly = true)
    fun list(paperId: Long, userId: Long): List<PaperCommentDto> {
        accessService.requireReadable(paperId, userId)
        val rows = commentRepository.findByPaperIdOrderByCreatedAtAsc(paperId)
        val users = userRepository.findAllById(rows.map { it.userId }).associateBy { it.id }
        return rows.map { it.toDto(users[it.userId]?.displayName ?: users[it.userId]?.email) }
    }

    @Transactional
    fun create(paperId: Long, userId: Long, request: CreateCommentRequest): PaperCommentDto {
        accessService.requireReadable(paperId, userId)
        val body = request.body.trim()
        if (body.isBlank()) throw InvalidParameterException("批注内容不能为空")
        val saved = commentRepository.save(
            PaperComment(
                paperId = paperId,
                userId = userId,
                anchor = request.anchor?.takeIf { it.isNotBlank() },
                quote = request.quote,
                body = body,
            ),
        )
        val author = userRepository.findById(userId).orElse(null)
        return saved.toDto(author?.displayName ?: author?.email)
    }

    @Transactional
    fun update(paperId: Long, commentId: Long, userId: Long, request: UpdateCommentRequest): PaperCommentDto {
        accessService.requireReadable(paperId, userId)
        val comment = commentRepository.findById(commentId).orElse(null)
            ?.takeIf { it.paperId == paperId }
            ?: throw ResourceNotFoundException("Comment", commentId)

        val isAuthor = comment.userId == userId
        // 改正文（body）只有批注作者能做；标记「已解决」作者或可写者（作者/EDITOR）都能做。
        if (request.body != null && !isAuthor) throw PermissionDeniedException()
        val canResolve = isAuthor || accessService.resolveRole(paperId, userId) == CollabRole.EDITOR
        if (request.resolved != null && !canResolve) throw PermissionDeniedException()

        val updated = comment.copy(
            body = request.body?.trim()?.takeIf { it.isNotBlank() } ?: comment.body,
            resolved = request.resolved ?: comment.resolved,
            updatedAt = Instant.now(),
        )
        val saved = commentRepository.save(updated)
        val author = userRepository.findById(saved.userId).orElse(null)
        return saved.toDto(author?.displayName ?: author?.email)
    }

    @Transactional
    fun delete(paperId: Long, commentId: Long, userId: Long) {
        val paper = accessService.requireReadable(paperId, userId)
        val comment = commentRepository.findById(commentId).orElse(null)
            ?.takeIf { it.paperId == paperId }
            ?: throw ResourceNotFoundException("Comment", commentId)
        // 批注作者或论文作者可删；其他人（包括其他 EDITOR）不能删别人的批注。
        if (comment.userId != userId && paper.userId != userId) throw PermissionDeniedException()
        commentRepository.delete(comment)
    }

    private fun PaperComment.toDto(authorName: String?) = PaperCommentDto(
        id = id,
        paperId = paperId,
        userId = userId,
        authorName = authorName,
        anchor = anchor,
        quote = quote,
        body = body,
        resolved = resolved,
        createdAt = createdAt,
        updatedAt = updatedAt,
    )
}
