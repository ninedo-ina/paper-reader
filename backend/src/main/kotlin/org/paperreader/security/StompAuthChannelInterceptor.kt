package org.paperreader.security

import org.paperreader.service.CollabRole
import org.paperreader.service.DeviceService
import org.paperreader.service.PaperAccessService
import org.springframework.messaging.Message
import org.springframework.messaging.MessageChannel
import org.springframework.messaging.MessagingException
import org.springframework.messaging.simp.stomp.StompCommand
import org.springframework.messaging.simp.stomp.StompHeaderAccessor
import org.springframework.messaging.support.ChannelInterceptor
import org.springframework.messaging.support.MessageHeaderAccessor
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.stereotype.Component

/**
 * STOMP 通道鉴权拦截器（W7 的前置安全修复）。
 *
 * 修复前：`/ws` 完全公开，STOMP 帧里的 senderId 由客户端自填、不与服务端身份绑定——
 * 等于给一个可伪造身份的实时通道接上文档写入。协作编辑落地前必须先堵上这个洞。
 *
 * 本拦截器做三件事：
 *  1. CONNECT：强制校验 JWT，把服务端核实过的 [UserPrincipal] 绑定到 STOMP 会话；
 *     无有效 token 直接拒绝连接。此后该会话所有帧都带这个不可伪造的身份。
 *  2. SUBSCRIBE：订阅 /topic/collab/{paperId} 必须对该论文可读；订阅 /topic/chat.{id}
 *     必须是本人——防止未授权者从实时通道读到正文或别人的私信（验收③）。
 *  3. SEND：向 /app/collab/{paperId}/update 发文档增量必须可写（EDITOR），
 *     awareness（在线状态）只读者也可发。
 *
 * 聊天 SEND 的 senderId 绑定在 ChatController 里从 Principal 取，不信任 payload。
 * 说明：/topic/group.* 沿用既有通配订阅，本轮不收紧（见技术方案「遗留项」）。
 */
@Component
class StompAuthChannelInterceptor(
    private val jwtUtil: JwtUtil,
    private val deviceService: DeviceService,
    private val accessService: PaperAccessService,
) : ChannelInterceptor {

    override fun preSend(message: Message<*>, channel: MessageChannel): Message<*> {
        val accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor::class.java)
            ?: return message

        when (accessor.command) {
            StompCommand.CONNECT -> {
                val auth = authenticate(accessor)
                    ?: throw MessagingException("STOMP 连接未通过身份认证")
                accessor.user = auth
            }
            StompCommand.SUBSCRIBE -> authorizeSubscribe(accessor)
            StompCommand.SEND -> authorizeSend(accessor)
            else -> {} // CONNECTED/DISCONNECT/心跳等无需鉴权
        }
        return message
    }

    /** 复刻 [JwtAuthFilter] 的判定：token 有效、非 2FA 挑战态、设备未被吊销。 */
    private fun authenticate(accessor: StompHeaderAccessor): UsernamePasswordAuthenticationToken? {
        val header = accessor.getFirstNativeHeader("Authorization") ?: return null
        if (!header.startsWith("Bearer ")) return null
        val token = header.substring(7)
        if (!jwtUtil.isTokenValid(token)) return null

        val claims = jwtUtil.extractClaims(token)
        val userId = claims.subject.toLong()
        val email = claims["email"] as? String ?: return null
        val isChallenge = claims[JwtUtil.SCOPE_CLAIM] == JwtUtil.SCOPE_TWO_FACTOR_CHALLENGE
        val deviceActive = deviceService.isDeviceActive(userId, claims[JwtUtil.DEVICE_CLAIM] as? String)
        if (isChallenge || !deviceActive) return null

        return UsernamePasswordAuthenticationToken(UserPrincipal(userId, email), null, emptyList())
    }

    private fun authorizeSubscribe(accessor: StompHeaderAccessor) {
        val dest = accessor.destination ?: return
        val userId = currentUserId(accessor)
        when {
            dest.startsWith(COLLAB_TOPIC_PREFIX) -> {
                val paperId = parsePaperId(dest.removePrefix(COLLAB_TOPIC_PREFIX)) ?: throw denied(dest)
                requireRead(paperId, userId)
            }
            dest.startsWith(CHAT_TOPIC_PREFIX) -> {
                val target = dest.removePrefix(CHAT_TOPIC_PREFIX).toLongOrNull()
                if (userId == null || target == null || target != userId) throw denied(dest)
            }
        }
    }

    private fun authorizeSend(accessor: StompHeaderAccessor) {
        val dest = accessor.destination ?: return
        val userId = currentUserId(accessor)
        if (dest.startsWith(COLLAB_APP_PREFIX)) {
            val paperId = parsePaperId(dest.removePrefix(COLLAB_APP_PREFIX)) ?: throw denied(dest)
            if (dest.endsWith("/update")) requireWrite(paperId, userId) else requireRead(paperId, userId)
        }
    }

    private fun currentUserId(accessor: StompHeaderAccessor): Long? =
        ((accessor.user as? UsernamePasswordAuthenticationToken)?.principal as? UserPrincipal)?.userId

    private fun requireRead(paperId: Long, userId: Long?) {
        if (userId == null || accessService.resolveRole(paperId, userId) == null) throw denied("collab/$paperId")
    }

    private fun requireWrite(paperId: Long, userId: Long?) {
        if (userId == null || accessService.resolveRole(paperId, userId) != CollabRole.EDITOR) throw denied("collab/$paperId")
    }

    /** "5" 或 "5/awareness" → 5。 */
    private fun parsePaperId(tail: String): Long? = tail.substringBefore('/').toLongOrNull()

    private fun denied(dest: String) = MessagingException("无权访问实时通道: $dest")

    companion object {
        private const val COLLAB_TOPIC_PREFIX = "/topic/collab/"
        private const val COLLAB_APP_PREFIX = "/app/collab/"
        private const val CHAT_TOPIC_PREFIX = "/topic/chat."
    }
}
