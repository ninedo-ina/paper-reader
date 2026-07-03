package org.paperreader.controller

import org.paperreader.dto.ApiResponse
import org.paperreader.exception.ResourceNotFoundException
import org.paperreader.repository.PaperRepository
import org.paperreader.security.UserPrincipal
import org.paperreader.service.FileStorageService
import org.paperreader.service.GrobidClient
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import java.time.Instant

@RestController
@RequestMapping("/api/papers/{paperId}/grobid")
class GrobidController(
    private val paperRepository: PaperRepository,
    private val grobidClient: GrobidClient,
    private val fileStorageService: FileStorageService,
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

        val pdfBytes = fileStorageService.read(paper.filePath)
        val teiXml = grobidClient.processHeader(pdfBytes)
        paperRepository.save(paper.copy(grobidResult = teiXml, updatedAt = Instant.now()))

        return ApiResponse(data = teiXml, message = "Parsing completed")
    }

    @GetMapping("/health")
    fun health(): ApiResponse<Map<String, Any>> =
        ApiResponse(data = mapOf("grobidUp" to grobidClient.isHealthy()))
}
