package org.paperreader.service

import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.boot.web.client.RestTemplateBuilder
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.header
import org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath
import org.springframework.test.web.client.match.MockRestRequestMatchers.method
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withServerError
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import java.time.Instant

/**
 * 通知中心客户端的契约测试：请求体形状、token 缓存、失败降级。
 * 模板长什么样是通知中心的事，这里只管「变量传对了、失败不影响主流程」。
 */
class NotifyCenterClientTest {

    private val restTemplate = RestTemplateBuilder().build()
    private val server = MockRestServiceServer.bindTo(restTemplate).build()

    private fun client(
        baseUrl: String = BASE_URL,
        accessKey: String = "test-access-key",
        accessSecret: String = "test-access-secret",
        enabled: Boolean = true,
    ) = NotifyCenterClient(
        restTemplate = restTemplate,
        objectMapper = ObjectMapper(),
        baseUrl = baseUrl,
        accessKey = accessKey,
        accessSecret = accessSecret,
        targetPackageName = "com.bendywork.paperhelper",
        targetAppId = "paperhelper",
        enabled = enabled,
    )

    private fun expectToken(token: String = "tok-1") {
        server.expect(requestTo("$BASE_URL/api/auth/token"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(jsonPath("$.access_key").value("test-access-key"))
            .andExpect(jsonPath("$.access_secret").value("test-access-secret"))
            .andRespond(withSuccess("""{"token":"$token","expires_in":3600}""", MediaType.APPLICATION_JSON))
    }

    private fun expectNotify() = server.expect(requestTo("$BASE_URL/api/notify"))
        .andExpect(method(HttpMethod.POST))
        .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON))

    @Test
    fun `login code goes out with the login template`() {
        expectToken()
        server.expect(requestTo("$BASE_URL/api/notify"))
            .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer tok-1"))
            .andExpect(jsonPath("$.target_package_name").value("com.bendywork.paperhelper"))
            .andExpect(jsonPath("$.target_app_id").value("paperhelper"))
            .andExpect(jsonPath("$.target_user_ids").value("7"))
            .andExpect(jsonPath("$.type").value("auth.email_code"))
            .andExpect(jsonPath("$.email_to").value("member@example.com"))
            .andExpect(jsonPath("$.template").value("paperhelper-login-code"))
            .andExpect(jsonPath("$.template_data.code").value("123456"))
            .andExpect(jsonPath("$.template_data.expires_minutes").value(5))
            .andExpect(jsonPath("$.template_data.email").value("member@example.com"))
            .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON))

        client().notifyLoginCode("member@example.com", "123456", 5, 7)

        server.verify()
    }

    @Test
    fun `unknown email is targeted as guest instead of broadcasting`() {
        expectToken()
        server.expect(requestTo("$BASE_URL/api/notify"))
            .andExpect(jsonPath("$.target_user_ids").value("guest"))
            .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON))

        client().notifyLoginCode("stranger@example.com", "000001", 5, null)

        server.verify()
    }

    @Test
    fun `private message carries sender and time`() {
        expectToken()
        server.expect(requestTo("$BASE_URL/api/notify"))
            .andExpect(jsonPath("$.type").value("message.private"))
            .andExpect(jsonPath("$.target_user_ids").value("2"))
            .andExpect(jsonPath("$.email_to").value("receiver@example.com"))
            .andExpect(jsonPath("$.template").value("paperhelper-message"))
            .andExpect(jsonPath("$.template_data.kind").value("private"))
            .andExpect(jsonPath("$.template_data.sender_name").value("Alice"))
            .andExpect(jsonPath("$.template_data.preview").value("在吗"))
            .andExpect(jsonPath("$.template_data.sent_at").value("2026-09-15 10:24"))
            .andExpect(jsonPath("$.template_data.group_name").doesNotExist())
            .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON))

        client().notifyDirectMessage(2, "receiver@example.com", "Alice", "在吗", Instant.parse("2026-09-15T02:24:00Z"))

        server.verify()
    }

    @Test
    fun `long message is truncated to 200 characters without splitting emoji`() {
        expectToken()

        // 纯 ASCII：正好截到 200 字再加省略号。
        server.expect(requestTo("$BASE_URL/api/notify"))
            .andExpect(jsonPath("$.template_data.preview").value("x".repeat(200) + "…"))
            .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON))

        // 第 200 个字符正好是 emoji 的高位代理：宁可少一个字，也不能切出半个字符。
        server.expect(requestTo("$BASE_URL/api/notify"))
            .andExpect(jsonPath("$.template_data.preview").value("x".repeat(199) + "…"))
            .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON))

        val client = client()
        client.notifyDirectMessage(
            2, "receiver@example.com", "Alice", "x".repeat(300), Instant.parse("2026-09-15T02:24:00Z"),
        )
        client.notifyDirectMessage(
            2, "receiver@example.com", "Alice", "x".repeat(199) + "😀".repeat(60), Instant.parse("2026-09-15T02:24:00Z"),
        )

        server.verify()
    }

    @Test
    fun `group message carries the group name`() {
        expectToken()
        server.expect(requestTo("$BASE_URL/api/notify"))
            .andExpect(jsonPath("$.type").value("message.group"))
            .andExpect(jsonPath("$.template").value("paperhelper-message"))
            .andExpect(jsonPath("$.template_data.kind").value("group"))
            .andExpect(jsonPath("$.template_data.group_name").value("论文小组"))
            .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON))

        client().notifyGroupMessage(
            3, "member@example.com", "Bob", "论文小组", "今晚读这篇", Instant.parse("2026-09-15T02:24:00Z"),
        )

        server.verify()
    }

    @Test
    fun `circle comment notifies the post author`() {
        expectToken()
        server.expect(requestTo("$BASE_URL/api/notify"))
            .andExpect(jsonPath("$.type").value("forum.comment"))
            .andExpect(jsonPath("$.target_user_ids").value("9"))
            .andExpect(jsonPath("$.email_to").value("author@example.com"))
            .andExpect(jsonPath("$.template").value("paperhelper-circle"))
            .andExpect(jsonPath("$.template_data.actor_name").value("Carol"))
            .andExpect(jsonPath("$.template_data.post_title").value("Attention 复现笔记"))
            .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON))

        client().notifyCircleComment(
            9, "author@example.com", "Carol", "Attention 复现笔记", "感谢分享", Instant.parse("2026-09-15T02:24:00Z"),
        )

        server.verify()
    }

    @Test
    fun `token is requested once and reused`() {
        expectToken()
        expectNotify()
        expectNotify()

        val client = client()
        client.notifyDirectMessage(2, "a@example.com", "Alice", "one", Instant.parse("2026-09-15T02:24:00Z"))
        client.notifyDirectMessage(2, "a@example.com", "Alice", "two", Instant.parse("2026-09-15T02:25:00Z"))

        // 只有一个 /api/auth/token 期望，被消费两次就会失败。
        server.verify()
    }

    @Test
    fun `delivery failure is swallowed`() {
        expectToken()
        server.expect(requestTo("$BASE_URL/api/notify")).andRespond(withServerError())

        val sent = client().send(
            type = "message.private",
            title = "t",
            body = "b",
            targetUserIds = "2",
            emailTo = "a@example.com",
            template = NotifyCenterClient.Template.MESSAGE,
            templateData = mapOf("kind" to "private"),
        )

        assertFalse(sent)
        server.verify()
    }

    @Test
    fun `token failure is swallowed`() {
        server.expect(requestTo("$BASE_URL/api/auth/token")).andRespond(withServerError())

        val sent = client().send(
            type = "message.private",
            title = "t",
            body = "b",
            targetUserIds = "2",
            emailTo = "a@example.com",
            template = NotifyCenterClient.Template.MESSAGE,
            templateData = emptyMap(),
        )

        assertFalse(sent)
        server.verify()
    }

    @Test
    fun `unconfigured client stays silent`() {
        val sent = client(baseUrl = "").send(
            type = "message.private",
            title = "t",
            body = "b",
            targetUserIds = "2",
            emailTo = "a@example.com",
            template = null,
            templateData = emptyMap(),
        )

        assertFalse(sent)
        // 没有任何 HTTP 期望：未配置时一个请求都不该发。
        server.verify()
    }

    @Test
    fun `disabled client stays silent`() {
        val sent = client(enabled = false).send(
            type = "auth.email_code",
            title = "t",
            body = "b",
            targetUserIds = "guest",
            emailTo = "a@example.com",
            template = NotifyCenterClient.Template.LOGIN_CODE,
            templateData = mapOf("code" to "123456"),
        )

        assertFalse(sent)
        server.verify()
    }

    @Test
    fun `configured client reports itself ready`() {
        assertTrue(client().isConfigured)
        assertFalse(client(accessKey = "").isConfigured)
    }

    private companion object {
        const val BASE_URL = "https://notify.test"
    }
}
