package org.paperreader.controller

import org.paperreader.dto.ApiResponse
import org.paperreader.dto.CreateCommentRequest
import org.paperreader.dto.PaperCommentDto
import org.paperreader.dto.UpdateCommentRequest
import org.paperreader.security.UserPrincipal
import org.paperreader.service.CommentService
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

/**
 * 编辑器正文批注（W7）。可读者（含 VIEWER / 导师）都能新建批注；改批注正文限作者，
 * 标记「已解决」作者或 EDITOR 可做，删批注限批注作者或论文作者。判定见 CommentService。
 */
@RestController
@RequestMapping("/api/papers")
class CommentController(
    private val commentService: CommentService,
) {
    @GetMapping("/{id}/comments")
    fun list(
        @PathVariable id: Long,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<List<PaperCommentDto>> = ApiResponse(data = commentService.list(id, principal.userId))

    @PostMapping("/{id}/comments")
    fun create(
        @PathVariable id: Long,
        @RequestBody request: CreateCommentRequest,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<PaperCommentDto> = ApiResponse(data = commentService.create(id, principal.userId, request))

    @PatchMapping("/{id}/comments/{commentId}")
    fun update(
        @PathVariable id: Long,
        @PathVariable commentId: Long,
        @RequestBody request: UpdateCommentRequest,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<PaperCommentDto> = ApiResponse(data = commentService.update(id, commentId, principal.userId, request))

    @DeleteMapping("/{id}/comments/{commentId}")
    fun delete(
        @PathVariable id: Long,
        @PathVariable commentId: Long,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<Nothing> {
        commentService.delete(id, commentId, principal.userId)
        return ApiResponse(message = "Deleted")
    }
}
