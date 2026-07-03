package org.paperreader.controller

import org.paperreader.dto.*
import org.paperreader.security.UserPrincipal
import org.paperreader.service.ReadingLogService
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/reading-logs")
class ReadingLogController(
    private val readingLogService: ReadingLogService,
) {
    @PostMapping
    fun record(
        @RequestBody request: CreateReadingLogRequest,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<ReadingLogDto> =
        ApiResponse(data = readingLogService.record(request, principal.userId))

    @GetMapping("/paper/{paperId}")
    fun getByPaper(
        @PathVariable paperId: Long,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<List<ReadingLogDto>> =
        ApiResponse(data = readingLogService.getByPaper(paperId, principal.userId))

    @GetMapping("/paper/{paperId}/progress")
    fun getProgress(
        @PathVariable paperId: Long,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<ReadingLogDto?> =
        ApiResponse(data = readingLogService.getCurrentProgress(paperId, principal.userId))

    @GetMapping("/recent")
    fun getRecent(
        @RequestParam(defaultValue = "20") limit: Int,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<List<ReadingLogDto>> =
        ApiResponse(data = readingLogService.getRecent(principal.userId, limit))
}
