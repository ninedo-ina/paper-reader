package org.paperreader.service

import com.fasterxml.jackson.databind.ObjectMapper
import org.paperreader.config.ContentProperties
import org.paperreader.dto.ContentSnapshotDetailDto
import org.paperreader.dto.ContentSnapshotSummaryDto
import org.paperreader.dto.PaperContentDto
import org.paperreader.exception.ContentVersionConflictException
import org.paperreader.exception.InvalidParameterException
import org.paperreader.exception.ResourceNotFoundException
import org.paperreader.model.Paper
import org.paperreader.model.PaperContentVersion
import org.paperreader.repository.PaperContentVersionRepository
import org.paperreader.repository.PaperRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.temporal.ChronoUnit

/**
 * 正文快照与回滚（W6，REQ-202609-0262）。
 *
 * 正文的权威存储始终是 pr_papers.content_json；本服务只是在它之外留时间线上的历史点位，
 * 不改变「读正文走 GET /content、写正文走 PUT /content」这条既有路径。
 *
 * 回滚的语义（验收标准：回滚动作本身也要产生一条新快照，且可再回滚回来）：
 * 回滚 = 「先给当前正文留一份自动快照（source=ROLLBACK），再把它替换成目标快照的正文」。
 * 两步都在同一个事务里，所以回滚不会丢失回滚前的正文，用户随时可以回滚到那条自动快照，
 * 也就回到了回滚之前的状态。
 */
@Service
class PaperContentVersionService(
    private val paperContentVersionRepository: PaperContentVersionRepository,
    private val paperRepository: PaperRepository,
    private val objectMapper: ObjectMapper,
    private val auditLogService: AuditLogService,
    private val contentProperties: ContentProperties,
) {
    /** 手动打快照，可带标签。正文为空（从未写过）时没有可留的快照，直接拒绝。 */
    @Transactional
    fun createSnapshot(paperId: Long, userId: Long, label: String?): ContentSnapshotSummaryDto {
        val paper = paperRepository.findByIdAndUserId(paperId, userId)
            ?: throw ResourceNotFoundException("Paper", paperId)
        val body = paper.contentJson
        if (body.isNullOrBlank()) {
            throw InvalidParameterException("正文为空，暂无可保存的快照")
        }

        val saved = paperContentVersionRepository.save(
            PaperContentVersion(
                paperId = paper.id,
                label = normalizeLabel(label),
                source = PaperContentVersion.SOURCE_MANUAL,
                contentVersion = paper.contentVersion ?: 0,
                contentJson = body,
                contentHtml = paper.contentHtml,
                createdBy = userId,
            )
        )
        auditLogService.log(userId, "创建正文快照", saved.label ?: paper.title)
        pruneSnapshots(paper.id, saved.id)
        return saved.toSummaryDto()
    }

    /** 时间线：新的在前。只回元信息，正文要取单条（快照可能很大）。 */
    fun listSnapshots(paperId: Long, userId: Long): List<ContentSnapshotSummaryDto> {
        requirePaper(paperId, userId)
        return paperContentVersionRepository.findByPaperIdOrderByCreatedAtDescIdDesc(paperId)
            .map { it.toSummaryDto() }
    }

    fun getSnapshot(paperId: Long, userId: Long, snapshotId: Long): ContentSnapshotDetailDto {
        requirePaper(paperId, userId)
        val snapshot = findSnapshot(paperId, snapshotId)
        return ContentSnapshotDetailDto(
            id = snapshot.id,
            paperId = snapshot.paperId,
            label = snapshot.label,
            source = snapshot.source,
            contentVersion = snapshot.contentVersion,
            contentJson = objectMapper.readTree(snapshot.contentJson),
            contentHtml = snapshot.contentHtml,
            createdAt = snapshot.createdAt,
        )
    }

    /** 重新打标签（含清空标签，传 null）。正文不动，因此不碰 content_version。 */
    @Transactional
    fun renameSnapshot(
        paperId: Long,
        userId: Long,
        snapshotId: Long,
        label: String?,
    ): ContentSnapshotSummaryDto {
        val paper = requirePaper(paperId, userId)
        val snapshot = findSnapshot(paperId, snapshotId)
        val saved = paperContentVersionRepository.save(snapshot.copy(label = normalizeLabel(label)))
        auditLogService.log(userId, "标记正文快照", saved.label ?: paper.title)
        return saved.toSummaryDto()
    }

    /**
     * 回滚到指定快照：先把当前正文留成一条自动快照，再用目标快照的正文覆盖正文，
     * content_version 自增（对客户端而言这仍是一次「保存」，用同一套冲突判定）。
     * 返回覆盖后的正文，前端据此同步本地版本号并重挂编辑器。
     */
    @Transactional
    fun restoreSnapshot(
        paperId: Long,
        userId: Long,
        snapshotId: Long,
        baseVersion: Int?,
    ): PaperContentDto {
        // 加悲观锁：回滚同样要读当前版本号再自增，不锁会和并发保存互相踩。
        val paper = paperRepository.findForUpdateByIdAndUserId(paperId, userId)
            ?: throw ResourceNotFoundException("Paper", paperId)
        val snapshot = findSnapshot(paperId, snapshotId)

        val currentVersion = paper.contentVersion ?: 0
        if (baseVersion != null && baseVersion != currentVersion) {
            throw ContentVersionConflictException(currentVersion)
        }

        // 回滚前留档：这一步让「回滚」本身可逆。当前正文为空时不产生空快照。
        val currentBody = paper.contentJson
        val rollbackSnapshot = if (!currentBody.isNullOrBlank()) {
            paperContentVersionRepository.save(
                PaperContentVersion(
                    paperId = paper.id,
                    label = null,
                    source = PaperContentVersion.SOURCE_ROLLBACK,
                    contentVersion = currentVersion,
                    contentJson = currentBody,
                    contentHtml = paper.contentHtml,
                    createdBy = userId,
                )
            )
        } else {
            null
        }

        val saved = paperRepository.save(
            paper.copy(
                contentJson = snapshot.contentJson,
                contentHtml = snapshot.contentHtml,
                contentVersion = currentVersion + 1,
                updatedAt = Instant.now(),
            )
        )
        auditLogService.log(userId, "回滚正文", snapshot.label ?: saved.title)
        // 刚留的档和刚回滚到的目标快照都不能在淘汰里被删掉，否则「回滚可逆」当场失效。
        pruneSnapshots(paper.id, *listOfNotNull(rollbackSnapshot?.id, snapshot.id).toLongArray())
        return saved.toContentDto()
    }

    /**
     * 快照保留策略（W9 交付物①：历史快照保留多少）。
     *
     * 快照里装的是整篇正文，只增不减的话「历史」就是无界的——一篇 2MB 的论文留 200 份就是 400MB。
     * 上限由 [ContentProperties.maxSnapshotCount] / [ContentProperties.maxSnapshotAgeDays] 定，
     * 并通过 `GET /api/papers/content-limits` 下发给客户端，服务端与前端读的是同一份契约。
     *
     * 淘汰顺序（每次写入快照后执行）：
     *  1. **按年龄**：删掉未打标签、且早于保留期的快照。手动标签是用户明说「这份要留着」，
     *     不因为时间久了被静默删除。
     *  2. **按份数**：仍超过上限时从最旧的开始删，先删未打标签的；只有剩下的全是标签快照时
     *     才动最旧的标签快照。份数是硬上限——否则「保留多少」就只是一句口号。
     *
     * [keepIds] 是本次写入涉及、必须留下的快照（刚创建的、刚回滚到的）。
     */
    private fun pruneSnapshots(paperId: Long, vararg keepIds: Long) {
        val keep = keepIds.toSet()
        val all = paperContentVersionRepository.findByPaperIdOrderByCreatedAtDescIdDesc(paperId)
        val candidates = all.filter { it.id !in keep }
        if (candidates.isEmpty()) return

        val cutoff = Instant.now().minus(contentProperties.maxSnapshotAgeDays.toLong(), ChronoUnit.DAYS)
        val expired = candidates.filter { it.label == null && it.createdAt.isBefore(cutoff) }

        val maxCount = contentProperties.maxSnapshotCount.coerceAtLeast(1)
        val overflow = all.size - expired.size - maxCount
        val byCount = if (overflow <= 0) {
            emptyList()
        } else {
            (candidates - expired.toSet())
                // 未打标签的排在前面，同组内最旧的排在前面。
                .sortedWith(compareBy({ it.label != null }, { it.createdAt }, { it.id }))
                .take(overflow)
        }

        val doomed = expired + byCount
        if (doomed.isNotEmpty()) {
            paperContentVersionRepository.deleteAll(doomed)
        }
    }

    private fun requirePaper(paperId: Long, userId: Long): Paper =
        paperRepository.findByIdAndUserId(paperId, userId)
            ?: throw ResourceNotFoundException("Paper", paperId)

    /** 单条查询必须同时按 paperId 过滤，避免用自己论文的路径读到别人论文的快照。 */
    private fun findSnapshot(paperId: Long, snapshotId: Long): PaperContentVersion =
        paperContentVersionRepository.findByIdAndPaperId(snapshotId, paperId)
            ?: throw ResourceNotFoundException("PaperContentVersion", snapshotId)

    /** 标签统一 trim；空串视同未打标签。超长直接拒，不要靠 DB 截断。 */
    private fun normalizeLabel(label: String?): String? {
        val trimmed = label?.trim().orEmpty()
        if (trimmed.isEmpty()) return null
        if (trimmed.length > MAX_LABEL_LENGTH) {
            throw InvalidParameterException("标签最多 ${MAX_LABEL_LENGTH} 个字符")
        }
        return trimmed
    }

    private fun PaperContentVersion.toSummaryDto() = ContentSnapshotSummaryDto(
        id = id,
        paperId = paperId,
        label = label,
        source = source,
        contentVersion = contentVersion,
        createdAt = createdAt,
    )

    private fun Paper.toContentDto() = PaperContentDto(
        paperId = id,
        contentJson = contentJson?.let { objectMapper.readTree(it) },
        contentHtml = contentHtml,
        contentVersion = contentVersion ?: 0,
        updatedAt = updatedAt,
    )

    companion object {
        /** 与 pr_paper_content_versions.label 的列宽一致。 */
        const val MAX_LABEL_LENGTH = 100
    }
}
