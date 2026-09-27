package org.paperreader.controller

import org.paperreader.dto.ApiResponse
import org.paperreader.dto.CreateShareRequest
import org.paperreader.dto.PublicSharePaperDto
import org.paperreader.dto.ShareLinkDto
import org.paperreader.security.UserPrincipal
import org.paperreader.service.ShareService
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

/**
 * 只读分享链接（W7）。作者侧：签发 / 列出 / 撤销（/api/papers/{id}/shares）。
 * 公开侧：/api/share/{token} 免登录读取只读正文（在 SecurityConfig 里 permitAll）。
 */
@RestController
class ShareController(
    private val shareService: ShareService,
) {
    @PostMapping("/api/papers/{id}/shares")
    fun create(
        @PathVariable id: Long,
        @RequestBody(required = false) request: CreateShareRequest?,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<ShareLinkDto> =
        ApiResponse(data = shareService.create(id, principal.userId, request ?: CreateShareRequest()))

    @GetMapping("/api/papers/{id}/shares")
    fun list(
        @PathVariable id: Long,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<List<ShareLinkDto>> = ApiResponse(data = shareService.list(id, principal.userId))

    @DeleteMapping("/api/papers/{id}/shares/{shareId}")
    fun revoke(
        @PathVariable id: Long,
        @PathVariable shareId: Long,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<Nothing> {
        shareService.revoke(id, shareId, principal.userId)
        return ApiResponse(message = "Revoked")
    }

    /** 免登录：凭 token 读取只读正文。无效 / 撤销 / 过期 → 1015/404（不区分原因）。 */
    @GetMapping("/api/share/{token}")
    fun resolve(@PathVariable token: String): ApiResponse<PublicSharePaperDto> =
        ApiResponse(data = shareService.resolvePublic(token))
}
