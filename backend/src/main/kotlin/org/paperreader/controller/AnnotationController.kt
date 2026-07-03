package org.paperreader.controller

import org.paperreader.dto.*
import org.paperreader.security.UserPrincipal
import org.paperreader.service.AnnotationService
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/annotations")
class AnnotationController(
    private val annotationService: AnnotationService,
) {
    @PostMapping
    fun create(
        @RequestBody request: CreateAnnotationRequest,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<AnnotationDto> =
        ApiResponse(data = annotationService.create(request, principal.userId))

    @PutMapping("/{id}")
    fun update(
        @PathVariable id: Long,
        @RequestBody request: UpdateAnnotationRequest,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<AnnotationDto> =
        ApiResponse(data = annotationService.update(id, request, principal.userId))

    @GetMapping("/paper/{paperId}")
    fun listByPaper(
        @PathVariable paperId: Long,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<List<AnnotationDto>> =
        ApiResponse(data = annotationService.listByPaper(paperId, principal.userId))

    @DeleteMapping("/{id}")
    fun delete(
        @PathVariable id: Long,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<Nothing> {
        annotationService.delete(id, principal.userId)
        return ApiResponse(message = "Deleted")
    }
}
