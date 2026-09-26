package org.paperreader.controller

import org.paperreader.dto.ApiResponse
import org.paperreader.dto.CreateExportRequest
import org.paperreader.dto.ExportArtifactDto
import org.paperreader.dto.ExportCapabilitiesDto
import org.paperreader.dto.ImportMarkdownRequest
import org.paperreader.dto.ImportResultDto
import org.paperreader.security.UserPrincipal
import org.paperreader.service.PaperExportService
import org.springframework.core.io.Resource
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

/**
 * 论文导出/导入接口（W5）/ Paper export & import endpoints.
 *
 * 导出走「生成即落库」两段式：POST 生成产物并登记（回挂版本记录），返回元信息含 downloadUrl；
 * 前端再 GET 下载。这样版本页/编辑器都能列出历史产物并二次下载。
 */
@RestController
@RequestMapping("/api/papers/{paperId}")
class PaperExportController(
    private val paperExportService: PaperExportService,
) {
    @GetMapping("/export/capabilities")
    fun capabilities(
        @PathVariable paperId: Long,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<ExportCapabilitiesDto> =
        ApiResponse(data = paperExportService.getCapabilities())

    @PostMapping("/export")
    fun export(
        @PathVariable paperId: Long,
        @RequestBody request: CreateExportRequest,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<ExportArtifactDto> =
        ApiResponse(data = paperExportService.export(paperId, principal.userId, request))

    @GetMapping("/export/artifacts")
    fun listArtifacts(
        @PathVariable paperId: Long,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<List<ExportArtifactDto>> =
        ApiResponse(data = paperExportService.listArtifacts(paperId, principal.userId))

    @GetMapping("/export/artifacts/{artifactId}/download")
    fun download(
        @PathVariable paperId: Long,
        @PathVariable artifactId: Long,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ResponseEntity<Resource> {
        val (filename, mediaType, resource) =
            paperExportService.downloadArtifact(paperId, artifactId, principal.userId)
        val encoded = URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+", "%20")
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"$filename\"; filename*=UTF-8''$encoded")
            .contentType(MediaType.parseMediaType(mediaType))
            .contentLength(resource.contentLength())
            .body(resource)
    }

    @PostMapping("/import/markdown")
    fun importMarkdown(
        @PathVariable paperId: Long,
        @RequestBody request: ImportMarkdownRequest,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<ImportResultDto> =
        ApiResponse(data = paperExportService.importMarkdown(paperId, principal.userId, request))
}
