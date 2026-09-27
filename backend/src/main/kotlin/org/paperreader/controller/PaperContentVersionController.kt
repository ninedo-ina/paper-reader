package org.paperreader.controller

import org.paperreader.dto.*
import org.paperreader.security.UserPrincipal
import org.paperreader.service.PaperContentVersionService
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

/**
 * 正文快照与回滚（W6）。与 [PaperVersionController] 的 `/versions`（发布记录）路径分开，
 * 避免两种语义混在一个集合里。
 */
@RestController
@RequestMapping("/api/papers/{paperId}/content-versions")
class PaperContentVersionController(
    private val paperContentVersionService: PaperContentVersionService,
) {
    @PostMapping
    fun create(
        @PathVariable paperId: Long,
        @RequestBody(required = false) request: CreateContentSnapshotRequest?,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<ContentSnapshotSummaryDto> =
        ApiResponse(
            data = paperContentVersionService.createSnapshot(paperId, principal.userId, request?.label),
        )

    @GetMapping
    fun list(
        @PathVariable paperId: Long,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<List<ContentSnapshotSummaryDto>> =
        ApiResponse(data = paperContentVersionService.listSnapshots(paperId, principal.userId))

    @GetMapping("/{snapshotId}")
    fun detail(
        @PathVariable paperId: Long,
        @PathVariable snapshotId: Long,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<ContentSnapshotDetailDto> =
        ApiResponse(data = paperContentVersionService.getSnapshot(paperId, principal.userId, snapshotId))

    @PatchMapping("/{snapshotId}")
    fun rename(
        @PathVariable paperId: Long,
        @PathVariable snapshotId: Long,
        @RequestBody(required = false) request: RenameContentSnapshotRequest?,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<ContentSnapshotSummaryDto> =
        ApiResponse(
            data = paperContentVersionService.renameSnapshot(paperId, principal.userId, snapshotId, request?.label),
        )

    /** 回滚：返回覆盖后的正文，前端据此更新本地版本号并重挂编辑器。 */
    @PostMapping("/{snapshotId}/restore")
    fun restore(
        @PathVariable paperId: Long,
        @PathVariable snapshotId: Long,
        @RequestBody(required = false) request: RestoreContentSnapshotRequest?,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<PaperContentDto> =
        ApiResponse(
            data = paperContentVersionService.restoreSnapshot(
                paperId,
                principal.userId,
                snapshotId,
                request?.baseVersion,
            ),
        )
}
