package org.paperreader.config

import org.paperreader.security.StompAuthChannelInterceptor
import org.springframework.context.annotation.Configuration
import org.springframework.messaging.simp.config.ChannelRegistration
import org.springframework.messaging.simp.config.MessageBrokerRegistry
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker
import org.springframework.web.socket.config.annotation.StompEndpointRegistry
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer

@Configuration
@EnableWebSocketMessageBroker
class WebSocketConfig(
    private val stompAuthChannelInterceptor: StompAuthChannelInterceptor,
) : WebSocketMessageBrokerConfigurer {

    override fun configureMessageBroker(registry: MessageBrokerRegistry) {
        registry.enableSimpleBroker("/topic", "/queue")
        registry.setApplicationDestinationPrefixes("/app")
    }

    override fun registerStompEndpoints(registry: StompEndpointRegistry) {
        registry.addEndpoint("/ws").setAllowedOriginPatterns("*")
    }

    /**
     * 入站通道挂鉴权拦截器：CONNECT 强制校验 JWT 并绑定服务端身份，SUBSCRIBE/SEND 按论文 ACL 放行。
     * `/ws` 端点本身仍在 SecurityConfig 里 permitAll（握手不带业务鉴权），真正的身份校验落在这里，
     * 避免了「公开通道 + 客户端自填身份」的伪造风险。见 [StompAuthChannelInterceptor]。
     */
    override fun configureClientInboundChannel(registration: ChannelRegistration) {
        registration.interceptors(stompAuthChannelInterceptor)
    }
}
