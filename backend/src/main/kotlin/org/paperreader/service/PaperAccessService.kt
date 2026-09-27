package org.paperreader.service

import org.paperreader.exception.PermissionDeniedException
import org.paperreader.exception.ResourceNotFoundException
import org.paperreader.model.Paper
import org.paperreader.repository.PaperCollaboratorRepository
import org.paperreader.repository.PaperRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/** 协作角色。论文作者是隐式 EDITOR；其余人的角色落在 pr_paper_collaborators。 */
enum class CollabRole { EDITOR, VIEWER }

/**
 * 协作权限判定的唯一入口（W7）。所有协作 / 批注 / 分享管理接口都必须先过这里，
 * 不要各自去 repo 里拼 ACL，避免判定口径漂移。
 *
 * 判定分层，直接对应验收「未授权用户拿不到正文」：
 *  - [requireReadable]：作者或任意协作者可读；否则一律 404（不泄露论文是否存在）。
 *  - [requireWritable]：作者或 EDITOR 可写；能读但不能写（VIEWER）→ 403（它知道存在，只是没权限）。
 *  - [requireOwner]：仅作者可管理协作者 / 分享链接；协作者 → 403，陌生人 → 404。
 */
@Service
class PaperAccessService(
    private val paperRepository: PaperRepository,
    private val collaboratorRepository: PaperCollaboratorRepository,
) {
    /** 作者=EDITOR；协作者=其登记角色；无任何关系=null（无权访问）。 */
    @Transactional(readOnly = true)
    fun resolveRole(paperId: Long, userId: Long): CollabRole? {
        val paper = paperRepository.findById(paperId).orElse(null) ?: return null
        if (paper.userId == userId) return CollabRole.EDITOR
        val collab = collaboratorRepository.findByPaperIdAndUserId(paperId, userId) ?: return null
        return runCatching { CollabRole.valueOf(collab.role) }.getOrNull()
    }

    @Transactional(readOnly = true)
    fun requireReadable(paperId: Long, userId: Long): Paper {
        val paper = paperRepository.findById(paperId).orElse(null)
            ?: throw ResourceNotFoundException("Paper", paperId)
        if (paper.userId == userId) return paper
        collaboratorRepository.findByPaperIdAndUserId(paperId, userId)
            ?: throw ResourceNotFoundException("Paper", paperId)
        return paper
    }

    @Transactional(readOnly = true)
    fun requireWritable(paperId: Long, userId: Long): Paper {
        // 先按可读判定：完全无关系的人得到 404（隐藏存在），而不是 403。
        val paper = requireReadable(paperId, userId)
        if (paper.userId == userId) return paper
        val collab = collaboratorRepository.findByPaperIdAndUserId(paperId, userId)
        if (collab?.role != CollabRole.EDITOR.name) throw PermissionDeniedException()
        return paper
    }

    @Transactional(readOnly = true)
    fun requireOwner(paperId: Long, userId: Long): Paper {
        val paper = paperRepository.findById(paperId).orElse(null)
            ?: throw ResourceNotFoundException("Paper", paperId)
        if (paper.userId != userId) {
            // 协作者知道论文存在（给 403）；陌生人不该知道（给 404）。
            collaboratorRepository.findByPaperIdAndUserId(paperId, userId)
                ?: throw ResourceNotFoundException("Paper", paperId)
            throw PermissionDeniedException()
        }
        return paper
    }
}
