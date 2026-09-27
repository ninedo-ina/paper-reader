package org.paperreader.service

import org.paperreader.dto.CollabStateDto
import org.paperreader.dto.SaveCollabStateRequest
import org.paperreader.model.PaperCollabState
import org.paperreader.repository.PaperCollabStateRepository
import org.paperreader.repository.PaperRepository
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

/**
 * 实时协同的服务端侧（W7）。核心原则：服务端不解析 CRDT，只做鉴权 + 全量快照持久化。
 * 实时增量的中转在 STOMP 通道里完成（见 CollabController + StompAuthChannelInterceptor），
 * 这里只负责「文档身份」的落地：新加入者先取快照还原，再接实时增量。
 */
@Service
class CollabService(
    private val accessService: PaperAccessService,
    private val collabStateRepository: PaperCollabStateRepository,
    private val paperRepository: PaperRepository,
) {
    /** 取快照（可读即可）。state 为空表示尚无协同状态，客户端应据正文播种。
     *  连同调用方角色一并返回，前端一次拿到「能不能写 / 是不是作者」，不必再多打一趟接口。 */
    @Transactional(readOnly = true)
    fun getState(paperId: Long, userId: Long): CollabStateDto {
        val paper = accessService.requireReadable(paperId, userId)
        val isOwner = paper.userId == userId
        // 作者是隐式 EDITOR，这里显式区分成 OWNER，好让前端只给作者开放协作者/分享管理。
        val role = if (isOwner) "OWNER" else accessService.resolveRole(paperId, userId)?.name ?: "VIEWER"
        val canWrite = isOwner || role == "EDITOR"
        val row = collabStateRepository.findById(paperId).orElse(null)
        return CollabStateDto(
            paperId = paperId,
            state = row?.state,
            updatedAt = row?.updatedAt,
            role = role,
            canWrite = canWrite,
            isOwner = isOwner,
        )
    }

    /**
     * 首次播种：seed-if-absent。并发时靠主键唯一冲突让「谁先插入谁为准」，
     * 落后者读回胜出者的状态——所有客户端因此收敛到同一份「文档身份」，避免正文重复。
     */
    @Transactional
    fun seedState(paperId: Long, userId: Long, base64State: String): CollabStateDto {
        accessService.requireWritable(paperId, userId)
        collabStateRepository.findById(paperId).orElse(null)?.let {
            return CollabStateDto(paperId, it.state, it.updatedAt)
        }
        return try {
            val saved = collabStateRepository.saveAndFlush(
                PaperCollabState(paperId = paperId, state = base64State),
            )
            CollabStateDto(paperId, saved.state, saved.updatedAt)
        } catch (e: DataIntegrityViolationException) {
            // 有人抢先播种了，采用它的（而不是覆盖），保证收敛到同一份。
            val winner = collabStateRepository.findById(paperId).orElseThrow { e }
            CollabStateDto(paperId, winner.state, winner.updatedAt)
        }
    }

    /**
     * 防抖保存：整份快照 LWW 覆盖（并发方经 Yjs 已收敛，各自全量快照等价）。
     * 同时把派生正文镜像回 pr_papers，让非协同路径（列表/导出/AI/只读分享）拿到最新正文。
     * 正文版本号自增：即便作者在别处以非协同方式打开，也能靠版本号察觉已被改动。
     */
    @Transactional
    fun saveState(paperId: Long, userId: Long, request: SaveCollabStateRequest): CollabStateDto {
        accessService.requireWritable(paperId, userId)
        val saved = collabStateRepository.save(
            PaperCollabState(paperId = paperId, state = request.state, updatedAt = Instant.now()),
        )
        if (request.contentJson != null && request.contentJson.isObject) {
            paperRepository.findForUpdateById(paperId)?.let { paper ->
                paperRepository.save(
                    paper.copy(
                        contentJson = request.contentJson.toString(),
                        contentHtml = request.contentHtml,
                        contentVersion = (paper.contentVersion ?: 0) + 1,
                        updatedAt = Instant.now(),
                    ),
                )
            }
        }
        return CollabStateDto(paperId, saved.state, saved.updatedAt)
    }
}
