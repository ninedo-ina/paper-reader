package org.paperreader.controller

import org.paperreader.dto.*
import org.paperreader.security.UserPrincipal
import org.paperreader.service.NoteService
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/notes")
class NoteController(
    private val noteService: NoteService,
) {
    @PostMapping
    fun create(
        @RequestBody request: CreateNoteRequest,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<NoteDto> =
        ApiResponse(data = noteService.create(request, principal.userId))

    @PutMapping("/{id}")
    fun update(
        @PathVariable id: Long,
        @RequestBody request: UpdateNoteRequest,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<NoteDto> =
        ApiResponse(data = noteService.update(id, request, principal.userId))

    @GetMapping("/paper/{paperId}")
    fun listByPaper(
        @PathVariable paperId: Long,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<List<NoteDto>> =
        ApiResponse(data = noteService.listByPaper(paperId, principal.userId))

    @GetMapping
    fun listAll(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") pageSize: Int,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<PageResponse<NoteDto>> =
        ApiResponse(data = noteService.listAll(principal.userId, page, pageSize))

    @DeleteMapping("/{id}")
    fun delete(
        @PathVariable id: Long,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<Nothing> {
        noteService.delete(id, principal.userId)
        return ApiResponse(message = "Deleted")
    }
}
