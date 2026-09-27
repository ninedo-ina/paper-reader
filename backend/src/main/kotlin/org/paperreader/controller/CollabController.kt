package org.paperreader.controller

import org.paperreader.dto.ApiResponse
import org.paperreader.dto.CollabStateDto
import org.paperreader.dto.SaveCollabStateRequest
import org.paperreader.dto.SeedCollabStateRequest
import org.paperreader.security.UserPrincipal
import org.paperreader.service.CollabService
import org.springframework.messaging.handler.annotation.DestinationVariable
import org.springframework.messaging.handler.annotation.MessageMapping
import org.springframework.messaging.handler.annotation.Payload
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

/**
 * 实时协同（W7）。两条路径互补：
 *  - REST：取 / 播种 / 持久化 Yjs 全量快照（文档身份的落地，跨会话稳定）。
 *  - STOMP：中转实时增量与在线状态。服务端只转发不透明 blob，不解析 CRDT。
 * 所有鉴权都在 [org.paperreader.service.PaperAccessService] / [org.paperreader.security.StompAuthChannelInterceptor] 里。
 */
@RestController
@RequestMapping("/api/papers")
class CollabController(
    private val collabService: CollabService,
    private val messagingTemplate: SimpMessagingTemplate,
) {
    @GetMapping("/{id}/collab/state")
    fun getState(
        @PathVariable id: Long,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<CollabStateDto> = ApiResponse(data = collabService.getState(id, principal.userId))

    @PostMapping("/{id}/collab/state")
    fun seedState(
        @PathVariable id: Long,
        @RequestBody request: SeedCollabStateRequest,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<CollabStateDto> = ApiResponse(data = collabService.seedState(id, principal.userId, request.state))

    @PutMapping("/{id}/collab/state")
    fun saveState(
        @PathVariable id: Long,
        @RequestBody request: SaveCollabStateRequest,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<CollabStateDto> = ApiResponse(data = collabService.saveState(id, principal.userId, request))

    /**
     * 中转文档增量：客户端 SEND 到 /app/collab/{id}/update（拦截器已校验可写），
     * 服务端原样广播到 /topic/collab/{id}。sender 会收到自己的回声——Yjs 增量幂等，无副作用。
     */
    @MessageMapping("/collab/{paperId}/update")
    fun relayUpdate(@DestinationVariable paperId: Long, @Payload payload: CollabRelayPayload) {
        messagingTemplate.convertAndSend("/topic/collab/$paperId", payload)
    }

    /** 中转在线状态（光标 / 选区）：只读者也可广播（拦截器按可读校验）。 */
    @MessageMapping("/collab/{paperId}/awareness")
    fun relayAwareness(@DestinationVariable paperId: Long, @Payload payload: CollabRelayPayload) {
        messagingTemplate.convertAndSend("/topic/collab/$paperId/awareness", payload)
    }

    /** [update] 为 base64 的 Yjs / awareness 增量；[origin] 是发送方 clientId，供前端跳过自身回声。 */
    data class CollabRelayPayload(val update: String, val origin: String? = null)
}
