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

    @PostMapping
    fun create(
        @RequestBody request: CreatePaperRequest,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<PaperDetailDto> =
        ApiResponse(data = paperService.createPaper(request, principal.userId))

    @GetMapping
    fun list(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") pageSize: Int,
        @RequestParam(required = false) sourceType: String?,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<PageResponse<PaperListDto>> {
        val sourceTypes = when (sourceType) {
            "create" -> listOf("MANUAL")
            "import" -> listOf("UPLOAD", "URL")
            else -> null
        }
        return ApiResponse(data = paperService.listPapers(principal.userId, page, pageSize, sourceTypes))
    }

    @GetMapping("/{id}")
    fun get(
        @PathVariable id: Long,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<PaperDetailDto> =
        ApiResponse(data = paperService.getPaper(id, principal.userId))

    @PatchMapping("/{id}")
    fun update(
        @PathVariable id: Long,
        @RequestBody request: UpdatePaperRequest,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<PaperDetailDto> =
        ApiResponse(data = paperService.updatePaper(id, principal.userId, request))

    @PutMapping("/{id}/favorite")
    fun toggleFavorite(
        @PathVariable id: Long,
        @RequestBody request: ToggleFavoriteRequest,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<PaperDetailDto> =
        ApiResponse(data = paperService.toggleFavorite(id, principal.userId, request.favorite))

    @GetMapping("/{id}/tags")
    fun listTags(
        @PathVariable id: Long,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<List<PaperTagDto>> =
        ApiResponse(data = paperService.listTags(id, principal.userId))

    @PostMapping("/{id}/tags")
    fun addTag(
        @PathVariable id: Long,
        @RequestBody request: AddTagRequest,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<PaperTagDto> =
        ApiResponse(data = paperService.addTag(id, principal.userId, request.tag))

    @DeleteMapping("/{id}/tags/{tag}")
    fun removeTag(
        @PathVariable id: Long,
        @PathVariable tag: String,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<Nothing> {
        paperService.removeTag(id, principal.userId, tag)
        return ApiResponse(message = "Deleted")
    }

    @PostMapping("/{id}/share")
    fun share(
        @PathVariable id: Long,
        @RequestBody request: SharePaperRequest,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<SharePaperResponse> =
        ApiResponse(data = paperService.sharePaper(id, principal.userId, request.description))

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
