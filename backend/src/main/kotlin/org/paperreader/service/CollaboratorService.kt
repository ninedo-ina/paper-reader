package org.paperreader.service

import org.paperreader.dto.AddCollaboratorRequest
import org.paperreader.dto.CollaboratorDto
import org.paperreader.dto.SharedPaperDto
import org.paperreader.exception.InvalidParameterException
import org.paperreader.model.PaperCollaborator
import org.paperreader.repository.PaperCollaboratorRepository
import org.paperreader.repository.PaperRepository
import org.paperreader.repository.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 结构化协作者管理（W7）。与自由文本的 participants（署名，仅展示）互补——真正的读写权限看这里。
 * 增删协作者只有作者能做（[PaperAccessService.requireOwner]）；列表任何可读者都能看。
 */
@Service
class CollaboratorService(
    private val accessService: PaperAccessService,
    private val collaboratorRepository: PaperCollaboratorRepository,
    private val paperRepository: PaperRepository,
    private val userRepository: UserRepository,
    private val auditLogService: AuditLogService,
) {
    @Transactional(readOnly = true)
    fun list(paperId: Long, userId: Long): List<CollaboratorDto> {
        accessService.requireReadable(paperId, userId)
        val rows = collaboratorRepository.findByPaperId(paperId)
        val users = userRepository.findAllById(rows.map { it.userId }).associateBy { it.id }
        return rows.map { row ->
            val u = users[row.userId]
            CollaboratorDto(
                id = row.id,
                paperId = row.paperId,
                userId = row.userId,
                email = u?.email ?: "",
                displayName = u?.displayName,
                role = row.role,
                createdAt = row.createdAt,
            )
        }
    }

    @Transactional
    fun add(paperId: Long, ownerId: Long, request: AddCollaboratorRequest): CollaboratorDto {
        accessService.requireOwner(paperId, ownerId)

        val role = request.role.trim().uppercase()
        if (role != CollabRole.EDITOR.name && role != CollabRole.VIEWER.name) {
            throw InvalidParameterException("协作者角色只能是 EDITOR 或 VIEWER")
        }
        val email = request.email.trim()
        if (email.isBlank()) throw InvalidParameterException("协作者邮箱不能为空")

        val user = userRepository.findByEmail(email).orElse(null)
            ?: throw InvalidParameterException("该邮箱尚未注册：$email")
        if (user.id == ownerId) {
            throw InvalidParameterException("论文作者本人无需添加为协作者")
        }

        // 已存在则更新角色（幂等），否则新增。
        val existing = collaboratorRepository.findByPaperIdAndUserId(paperId, user.id)
        val saved = if (existing != null) {
            collaboratorRepository.save(existing.copy(role = role))
        } else {
            collaboratorRepository.save(
                PaperCollaborator(
                    paperId = paperId,
                    userId = user.id,
                    role = role,
                    createdBy = ownerId,
                ),
            )
        }
        auditLogService.log(ownerId, "添加协作者($role)", email)
        return CollaboratorDto(
            id = saved.id,
            paperId = saved.paperId,
            userId = saved.userId,
            email = user.email,
            displayName = user.displayName,
            role = saved.role,
            createdAt = saved.createdAt,
        )
    }

    @Transactional
    fun remove(paperId: Long, ownerId: Long, targetUserId: Long) {
        accessService.requireOwner(paperId, ownerId)
        collaboratorRepository.deleteByPaperIdAndUserId(paperId, targetUserId)
        auditLogService.log(ownerId, "移除协作者", "paper=$paperId user=$targetUserId")
    }

    /** 「与我协作」：我作为协作者（非作者）被授权的论文。 */
    @Transactional(readOnly = true)
    fun sharedWithMe(userId: Long): List<SharedPaperDto> {
        val rows = collaboratorRepository.findByUserId(userId)
        val papers = paperRepository.findAllById(rows.map { it.paperId }).associateBy { it.id }
        val owners = userRepository.findAllById(papers.values.map { it.userId }).associateBy { it.id }
        return rows.mapNotNull { row ->
            val paper = papers[row.paperId] ?: return@mapNotNull null
            SharedPaperDto(
                paperId = paper.id,
                title = paper.title,
                role = row.role,
                ownerId = paper.userId,
                ownerName = owners[paper.userId]?.displayName ?: owners[paper.userId]?.email,
                updatedAt = paper.updatedAt,
            )
        }.sortedByDescending { it.updatedAt }
    }
}
