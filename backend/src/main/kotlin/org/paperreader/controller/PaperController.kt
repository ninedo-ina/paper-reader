package org.paperreader.controller

import org.paperreader.dto.*
import org.paperreader.security.UserPrincipal
import org.paperreader.service.PaperService
import org.springframework.core.io.ByteArrayResource
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile

@RestController
@RequestMapping("/api/papers")
class PaperController(
    private val paperService: PaperService,
) {
    @PostMapping("/upload")
    fun upload(
        @RequestParam("file") file: MultipartFile,
        @RequestParam("title", required = false) title: String?,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<PaperDetailDto> =
        ApiResponse(data = paperService.uploadPdf(file, principal.userId, title))

    @PostMapping("/url")
    fun uploadFromUrl(
        @RequestBody request: UploadFromUrlRequest,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<PaperDetailDto> =
        ApiResponse(data = paperService.uploadFromUrl(request, principal.userId))

    @GetMapping
    fun list(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") pageSize: Int,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<PageResponse<PaperListDto>> =
        ApiResponse(data = paperService.listPapers(principal.userId, page, pageSize))

    @GetMapping("/{id}")
    fun get(
        @PathVariable id: Long,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<PaperDetailDto> =
        ApiResponse(data = paperService.getPaper(id, principal.userId))

    @GetMapping("/{id}/download")
    fun download(
        @PathVariable id: Long,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ResponseEntity<ByteArrayResource> {
        val (filename, bytes) = paperService.downloadPaper(id, principal.userId)
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"$filename\"")
            .contentType(MediaType.APPLICATION_PDF)
            .body(ByteArrayResource(bytes))
    }

    @DeleteMapping("/{id}")
    fun delete(
        @PathVariable id: Long,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<Nothing> {
        paperService.deletePaper(id, principal.userId)
        return ApiResponse(message = "Deleted")
    }
}
