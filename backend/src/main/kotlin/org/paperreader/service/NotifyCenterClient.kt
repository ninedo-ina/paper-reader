package org.paperreader.service

import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.scheduling.annotation.Async
import org.springframework.stereotype.Service
import org.springframework.web.client.RestTemplate
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * 通知中心客户端 / Client for the bendywork notify center.
 *
 * PaperHelper 没有自建邮箱，钉死一条链路：验证码、私信、群消息、科研圈子提醒
 * 全部交给通知中心投递（AKSK 换 token -> POST /api/notify），自己不发邮件。
 *
 * 约定：所有方法都是「尽力而为」——未配置或调用失败时只记一条 WARN，
 * 绝不影响登录、发消息、评论这些主流程；邮件发不出去时用户重试即可。
 * 模板名与模板变量见 `docs/NOTIFICATION_TEMPLATES.md`。
 */
@Service
class NotifyCenterClient(
    @Qualifier("notifyRestTemplate") private val restTemplate: RestTemplate,
    private val objectMapper: ObjectMapper,
    @Value("\${app.notify.base-url:}") private val baseUrl: String,
    @Value("\${app.notify.access-key:}") private val accessKey: String,
    @Value("\${app.notify.access-secret:}") private val accessSecret: String,
    @Value("\${app.notify.target-package-name:com.bendywork.paperhelper}") private val targetPackageName: String,
    @Value("\${app.notify.target-app-id:paperhelper}") private val targetAppId: String,
    @Value("\${app.notify.enabled:true}") private val enabled: Boolean,
) {
    private val logger = LoggerFactory.getLogger(NotifyCenterClient::class.java)

    @Volatile
    private var cachedToken: String? = null

    @Volatile
    private var cachedTokenExpiresAt: Instant = Instant.EPOCH

    private val tokenLock = Any()

    /** 邮箱里不认得的用户，用一个不会匹配任何在线连接的 target。 */
    private val guestTarget = "guest"

    enum class Template(val wireName: String) {
        LOGIN_CODE("paperhelper-login-code"),
        MESSAGE("paperhelper-message"),
        CIRCLE("paperhelper-circle"),
    }

    val isConfigured: Boolean
        get() = enabled &&
            baseUrl.isNotBlank() &&
            accessKey.isNotBlank() &&
            accessSecret.isNotBlank() &&
            targetPackageName.isNotBlank() &&
            targetAppId.isNotBlank()

    /** 登录验证码：用户收不到这封就登不进来。 */
    @Async("notifyExecutor")
    fun notifyLoginCode(email: String, code: String, expiresMinutes: Long, userId: Long?) {
        if (!isConfigured) return
        send(
            type = "auth.email_code",
            title = "笨迪论文助手登录验证码",
            // 模板没上线时走纯文本兜底，验证码必须出现在正文里，否则用户拿不到码。
            body = "你的登录验证码是 $code，$expiresMinutes 分钟内有效。\n" +
                "如果不是你本人操作，忽略这封邮件即可，你的账号不会有任何变化。",
            targetUserIds = userId?.toString() ?: guestTarget,
            emailTo = email,
            template = Template.LOGIN_CODE,
            templateData = mapOf(
                "code" to code,
                "expires_minutes" to expiresMinutes,
                "email" to email,
            ),
        )
    }

    /** 收到他人私信。 */
    @Async("notifyExecutor")
    fun notifyDirectMessage(
        recipientId: Long,
        recipientEmail: String,
        senderName: String,
        content: String,
        sentAt: Instant,
    ) {
        if (!isConfigured) return
        val preview = preview(content)
        send(
            type = "message.private",
            title = "$senderName 给你发了私信",
            body = "$senderName 给你发了私信：\n\n$preview",
            targetUserIds = recipientId.toString(),
            emailTo = recipientEmail,
            template = Template.MESSAGE,
            templateData = mapOf(
                "kind" to "private",
                "sender_name" to senderName,
                "preview" to preview,
                "sent_at" to formatTime(sentAt),
            ),
        )
    }

    /** 收到群消息，调用方已按「同群同人 10 分钟一封」节流。 */
    @Async("notifyExecutor")
    fun notifyGroupMessage(
        recipientId: Long,
        recipientEmail: String,
        senderName: String,
        groupName: String,
        content: String,
        sentAt: Instant,
    ) {
        if (!isConfigured) return
        val preview = preview(content)
        send(
            type = "message.group",
            title = "$senderName 在「$groupName」发了消息",
            body = "$senderName 在「$groupName」发了消息：\n\n$preview",
            targetUserIds = recipientId.toString(),
            emailTo = recipientEmail,
            template = Template.MESSAGE,
            templateData = mapOf(
                "kind" to "group",
                "sender_name" to senderName,
                "group_name" to groupName,
                "preview" to preview,
                "sent_at" to formatTime(sentAt),
            ),
        )
    }

    /** 科研圈子里自己的帖子被评论 / 回复。 */
    @Async("notifyExecutor")
    fun notifyCircleComment(
        authorId: Long,
        authorEmail: String,
        actorName: String,
        postTitle: String,
        content: String,
        sentAt: Instant,
    ) {
        if (!isConfigured) return
        val preview = preview(content)
        send(
            type = "forum.comment",
            title = "$actorName 评论了你的帖子",
            body = "$actorName 在科研圈子里评论了你的帖子「$postTitle」：\n\n$preview",
            targetUserIds = authorId.toString(),
            emailTo = authorEmail,
            template = Template.CIRCLE,
            templateData = mapOf(
                "actor_name" to actorName,
                "post_title" to postTitle,
                "preview" to preview,
                "sent_at" to formatTime(sentAt),
            ),
        )
    }

    /**
     * 真正发一条通知。返回是否被通知中心接受；任何失败都只记 WARN。
     * 业务代码请用上面的 notifyXxx（异步）方法。
     */
    fun send(
        type: String,
        title: String,
        body: String,
        targetUserIds: String,
        emailTo: String?,
        template: Template?,
        templateData: Map<String, Any?>,
    ): Boolean {
        if (!isConfigured) {
            logger.debug("Notify center not configured, skipping {} notification", type)
            return false
        }
        val token = obtainToken() ?: return false

        val payload = linkedMapOf<String, Any?>(
            "target_package_name" to targetPackageName,
            "target_app_id" to targetAppId,
            "target_user_ids" to targetUserIds,
            "type" to type,
            "title" to title,
            "body" to body,
        )
        if (!emailTo.isNullOrBlank()) payload["email_to"] = emailTo
        if (template != null) {
            payload["template"] = template.wireName
            payload["template_data"] = templateData
        }

        return try {
            val headers = HttpHeaders().apply {
                contentType = MediaType.APPLICATION_JSON
                setBearerAuth(token)
            }
            restTemplate.exchange(
                "$baseUrl/api/notify",
                HttpMethod.POST,
                HttpEntity(payload, headers),
                String::class.java,
            )
            true
        } catch (ex: Exception) {
            logger.warn("Notify center delivery failed for {}: {}", type, ex.message)
            false
        }
    }

    /** AKSK 换 token，带进程内缓存，过期前 60 秒刷新。 */
    private fun obtainToken(): String? {
        cachedToken?.let { if (Instant.now().isBefore(cachedTokenExpiresAt)) return it }
        synchronized(tokenLock) {
            cachedToken?.let { if (Instant.now().isBefore(cachedTokenExpiresAt)) return it }
            return try {
                val headers = HttpHeaders().apply { contentType = MediaType.APPLICATION_JSON }
                val response = restTemplate.exchange(
                    "$baseUrl/api/auth/token",
                    HttpMethod.POST,
                    HttpEntity(mapOf("access_key" to accessKey, "access_secret" to accessSecret), headers),
                    String::class.java,
                )
                val node = objectMapper.readTree(response.body ?: "")
                val token = node.path("token").asText("")
                if (token.isBlank()) {
                    logger.warn("Notify center returned no token")
                    return null
                }
                val expiresIn = node.path("expires_in").asLong(86_400)
                cachedToken = token
                cachedTokenExpiresAt = Instant.now().plusSeconds((expiresIn - 60).coerceAtLeast(30))
                token
            } catch (ex: Exception) {
                logger.warn("Notify center token request failed: {}", ex.message)
                null
            }
        }
    }

    private fun preview(content: String): String {
        val text = content.trim()
        if (text.length <= MAX_PREVIEW) return text
        // 别把代理对（emoji 等）切成半个字符。
        var end = MAX_PREVIEW
        if (Character.isHighSurrogate(text[end - 1])) end -= 1
        return text.substring(0, end) + "…"
    }

    private fun formatTime(instant: Instant): String =
        TIME_FORMATTER.format(instant.atZone(ZoneId.of("Asia/Shanghai")))

    companion object {
        private const val MAX_PREVIEW = 200
        private val TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")
    }
}
