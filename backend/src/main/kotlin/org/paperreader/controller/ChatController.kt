package org.paperreader.controller

import org.paperreader.dto.ApiResponse
import org.paperreader.security.UserPrincipal
import org.paperreader.service.ChatService
import org.springframework.messaging.handler.annotation.MessageMapping
import org.springframework.messaging.handler.annotation.Payload
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import java.security.Principal

@RestController
@RequestMapping("/api/chat")
class ChatController(
    private val chatService: ChatService,
    private val messagingTemplate: SimpMessagingTemplate,
) {
    @GetMapping("/recent-contacts")
    fun recentContacts(@AuthenticationPrincipal principal: UserPrincipal): ApiResponse<*> =
        ApiResponse(data = chatService.listRecentContacts(principal.userId))

    @GetMapping("/friends")
    fun friends(@AuthenticationPrincipal principal: UserPrincipal): ApiResponse<*> =
        ApiResponse(data = chatService.listFriends(principal.userId))

    @GetMapping("/messages")
    fun messages(
        @AuthenticationPrincipal principal: UserPrincipal,
        @RequestParam targetId: Long,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "30") size: Int,
    ): ApiResponse<*> = ApiResponse(data = chatService.getMessages(principal.userId, targetId, page, size))

    @GetMapping("/groups")
    fun groups(@AuthenticationPrincipal principal: UserPrincipal): ApiResponse<*> =
        ApiResponse(data = chatService.listGroups(principal.userId))

    @PostMapping("/groups")
    fun createGroup(
        @AuthenticationPrincipal principal: UserPrincipal,
        @RequestBody body: CreateGroupBody,
    ): ApiResponse<*> = ApiResponse(data = chatService.createGroup(body.name, principal.userId, body.memberIds))

    @GetMapping("/groups/{id}/messages")
    fun groupMessages(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable id: Long,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "30") size: Int,
    ): ApiResponse<*> = ApiResponse(data = chatService.getGroupMessages(id, principal.userId, page, size))

    @PostMapping("/follow/{id}")
    fun toggleFollow(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable id: Long,
    ): ApiResponse<*> = ApiResponse(data = chatService.toggleFollow(principal.userId, id))

    @MessageMapping("/chat.private")
    fun handlePrivateMessage(@Payload payload: PrivateMessagePayload, principal: Principal) {
        // senderId 一律取自服务端在 CONNECT 时核实并绑定的身份，忽略 payload 里客户端自填的
        // senderId——否则任何人都能冒充别人发消息（见 StompAuthChannelInterceptor）。
        val senderId = userId(principal)
        val msg = chatService.sendMessage(senderId, payload.receiverId, payload.content)
        messagingTemplate.convertAndSend("/topic/chat.${payload.receiverId}", msg)
        messagingTemplate.convertAndSend("/topic/chat.$senderId", msg)
    }

    @MessageMapping("/chat.group")
    fun handleGroupMessage(@Payload payload: GroupMessagePayload, principal: Principal) {
        val senderId = userId(principal)
        val msg = chatService.sendGroupMessage(payload.groupId, senderId, payload.content)
        messagingTemplate.convertAndSend("/topic/group.${payload.groupId}", msg)
    }

    private fun userId(principal: Principal): Long =
        ((principal as UsernamePasswordAuthenticationToken).principal as UserPrincipal).userId

    data class CreateGroupBody(val name: String, val memberIds: List<Long>)
    // senderId 保留仅为兼容旧前端的报文格式，服务端不信任它（改用 Principal），见上。
    data class PrivateMessagePayload(val senderId: Long? = null, val receiverId: Long, val content: String)
    data class GroupMessagePayload(val senderId: Long? = null, val groupId: Long, val content: String)
}
