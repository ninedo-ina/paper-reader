package org.paperreader.service

import com.fasterxml.jackson.databind.ObjectMapper
import org.paperreader.dto.CreateShareRequest
import org.paperreader.dto.PublicSharePaperDto
import org.paperreader.dto.ShareLinkDto
import org.paperreader.exception.ResourceNotFoundException
import org.paperreader.exception.ShareLinkInvalidException
import org.paperreader.model.PaperShare
import org.paperreader.repository.PaperRepository
import org.paperreader.repository.PaperShareRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.security.SecureRandom
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.Base64

/**
 * 只读分享链接（W7）。凭 token 免登录读取论文正文（只读），供没有账号的导师/合作者查看。
 * 签发 / 撤销只有作者能做；公开解析（[resolvePublic]）不鉴权，但严格校验 token 有效性。
 */
@Service
class ShareService(
    private val accessService: PaperAccessService,
    private val shareRepository: PaperShareRepository,
    private val paperRepository: PaperRepository,
    private val objectMapper: ObjectMapper,
    private val auditLogService: AuditLogService,
) {
    private val random = SecureRandom()
    private val encoder = Base64.getUrlEncoder().withoutPadding()

    @Transactional
    fun create(paperId: Long, userId: Long, request: CreateShareRequest): ShareLinkDto {
        accessService.requireOwner(paperId, userId)
        val expiresAt = request.expiresInDays
            ?.takeIf { it > 0 }
            ?.let { Instant.now().plus(it, ChronoUnit.DAYS) }
        val saved = shareRepository.save(
            PaperShare(
                paperId = paperId,
                token = generateToken(),
                role = "VIEWER",
                createdBy = userId,
                expiresAt = expiresAt,
            ),
        )
        auditLogService.log(userId, "创建只读分享链接", "paper=$paperId")
        return saved.toDto()
    }

    @Transactional(readOnly = true)
    fun list(paperId: Long, userId: Long): List<ShareLinkDto> {
        accessService.requireOwner(paperId, userId)
        return shareRepository.findByPaperIdOrderByCreatedAtDesc(paperId).map { it.toDto() }
    }

    @Transactional
    fun revoke(paperId: Long, shareId: Long, userId: Long) {
        accessService.requireOwner(paperId, userId)
        val share = shareRepository.findById(shareId).orElse(null)
            ?.takeIf { it.paperId == paperId }
            ?: throw ResourceNotFoundException("Share", shareId)
        shareRepository.save(share.copy(revoked = true))
        auditLogService.log(userId, "撤销只读分享链接", "paper=$paperId")
    }

    /**
     * 公开解析：免登录。无效 / 已撤销 / 已过期一律抛 [ShareLinkInvalidException]（404），
     * 不区分具体原因，避免泄露论文是否存在或曾被分享。返回镜像在 pr_papers 的最新只读正文。
     */
    @Transactional(readOnly = true)
    fun resolvePublic(token: String): PublicSharePaperDto {
        val share = shareRepository.findByToken(token) ?: throw ShareLinkInvalidException()
        if (share.revoked) throw ShareLinkInvalidException()
        if (share.expiresAt?.isBefore(Instant.now()) == true) throw ShareLinkInvalidException()

        val paper = paperRepository.findById(share.paperId).orElse(null)
            ?: throw ShareLinkInvalidException()
        return PublicSharePaperDto(
            paperId = paper.id,
            title = paper.title,
            authors = paper.authors,
            participants = paper.participants,
            abstractText = paper.abstractText,
            contentHtml = paper.contentHtml,
            contentJson = paper.contentJson?.let { objectMapper.readTree(it) },
            updatedAt = paper.updatedAt,
        )
    }

    /** URL-safe、无填充，约 43 字符，落在 token VARCHAR(64) 内。 */
    private fun generateToken(): String {
        val bytes = ByteArray(32)
        random.nextBytes(bytes)
        return encoder.encodeToString(bytes)
    }

    private fun PaperShare.toDto() = ShareLinkDto(
        id = id,
        paperId = paperId,
        token = token,
        role = role,
        expiresAt = expiresAt,
        revoked = revoked,
        createdAt = createdAt,
    )
}
