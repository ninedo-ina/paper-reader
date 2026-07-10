package org.paperreader.controller

import org.paperreader.dto.*
import org.paperreader.security.UserPrincipal
import org.paperreader.service.PaperVersionService
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/papers/{paperId}/versions")
class PaperVersionController(
    private val paperVersionService: PaperVersionService,
) {
    @PostMapping
    fun create(
        @PathVariable paperId: Long,
        @RequestBody request: CreateVersionRequest,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<PaperVersionDto> =
        ApiResponse(data = paperVersionService.createVersion(paperId, principal.userId, request))

    @GetMapping
    fun list(
        @PathVariable paperId: Long,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<List<PaperVersionDto>> =
        ApiResponse(data = paperVersionService.listVersions(paperId, principal.userId))
}
