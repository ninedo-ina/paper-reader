package org.paperreader.controller

import org.paperreader.dto.ApiResponse
import org.paperreader.exception.ResourceNotFoundException
import org.paperreader.repository.PaperRepository
import org.paperreader.security.UserPrincipal
import org.paperreader.service.GrobidClient
import org.paperreader.service.PaperParsingService
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/papers/{paperId}/grobid")
class GrobidController(
    private val paperRepository: PaperRepository,
    private val grobidClient: GrobidClient,
    private val paperParsingService: PaperParsingService,
) {
    @GetMapping
    fun getResult(
        @PathVariable paperId: Long,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<String> {
        val paper = paperRepository.findByIdAndUserId(paperId, principal.userId)
            ?: throw ResourceNotFoundException("Paper", paperId)

        if (paper.grobidResult.isNullOrBlank()) {
            return ApiResponse(message = "GROBID result not yet available, try re-parse")
        }
        return ApiResponse(data = paper.grobidResult)
    }

    @PostMapping("/parse")
    fun reparse(
        @PathVariable paperId: Long,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<String> {
        val paper = paperRepository.findByIdAndUserId(paperId, principal.userId)
            ?: throw ResourceNotFoundException("Paper", paperId)

        paper.filePath ?: throw IllegalArgumentException("This paper has no file to reparse")
        val pending = paperParsingService.requestParse(paper)
        return ApiResponse(data = pending.grobidResult, message = "Parsing started")
    }

    @GetMapping("/health")
    fun health(): ApiResponse<Map<String, Any>> =
        ApiResponse(data = mapOf("grobidUp" to grobidClient.isHealthy()))
}
