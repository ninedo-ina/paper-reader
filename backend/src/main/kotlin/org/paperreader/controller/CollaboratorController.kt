package org.paperreader.controller

import org.paperreader.dto.AddCollaboratorRequest
import org.paperreader.dto.ApiResponse
import org.paperreader.dto.CollaboratorDto
import org.paperreader.dto.SharedPaperDto
import org.paperreader.security.UserPrincipal
import org.paperreader.service.CollaboratorService
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

/**
 * 结构化协作者管理（W7）。增删仅作者可做；列表任何可读者可看。
 * 「与我协作」列表放在这里（我作为协作者被授权的论文）。
 */
@RestController
@RequestMapping("/api/papers")
class CollaboratorController(
    private val collaboratorService: CollaboratorService,
) {
    /** 与我协作：字面量路径，优先于 /{id} 匹配（与 upload-quota 同一套路）。 */
    @GetMapping("/shared-with-me")
    fun sharedWithMe(
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<List<SharedPaperDto>> = ApiResponse(data = collaboratorService.sharedWithMe(principal.userId))

    @GetMapping("/{id}/collaborators")
    fun list(
        @PathVariable id: Long,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<List<CollaboratorDto>> = ApiResponse(data = collaboratorService.list(id, principal.userId))

    @PostMapping("/{id}/collaborators")
    fun add(
        @PathVariable id: Long,
        @RequestBody request: AddCollaboratorRequest,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<CollaboratorDto> = ApiResponse(data = collaboratorService.add(id, principal.userId, request))

    @DeleteMapping("/{id}/collaborators/{userId}")
    fun remove(
        @PathVariable id: Long,
        @PathVariable userId: Long,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<Nothing> {
        collaboratorService.remove(id, principal.userId, userId)
        return ApiResponse(message = "Deleted")
    }
}
