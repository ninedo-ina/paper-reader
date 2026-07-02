package org.paperreader.controller

import org.paperreader.dto.*
import org.paperreader.security.UserPrincipal
import org.paperreader.service.AiChatService
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/ai-chats")
class AiChatController(
    private val aiChatService: AiChatService,
) {
    @PostMapping
    fun create(
        @RequestBody request: CreateChatRequest,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<AiChatDetailDto> =
        ApiResponse(data = aiChatService.createChat(request, principal.userId))

    @PostMapping("/{id}/messages")
    fun sendMessage(
        @PathVariable id: Long,
        @RequestBody request: ChatRequest,
        @RequestParam(required = false) model: String?,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<AiChatDetailDto> =
        ApiResponse(data = aiChatService.sendMessage(id, principal.userId, request, model))

    @GetMapping
    fun list(
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<List<AiChatListDto>> =
        ApiResponse(data = aiChatService.listChats(principal.userId))

    @GetMapping("/{id}")
    fun get(
        @PathVariable id: Long,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<AiChatDetailDto> =
        ApiResponse(data = aiChatService.getChat(id, principal.userId))

    @DeleteMapping("/{id}")
    fun delete(
        @PathVariable id: Long,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<Nothing> {
        aiChatService.deleteChat(id, principal.userId)
        return ApiResponse(message = "Deleted")
    }
}
