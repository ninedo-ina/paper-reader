package org.paperreader.config

import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.http.HttpStatus
import org.springframework.mock.web.MockFilterChain
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse

/**
 * 正文请求体预检（W9）。这里只测"拦截决策"：判的是请求头里的 Content-Length，
 * 不读 body，所以不需要真的造 16MB 数据。
 */
class ContentPayloadSizeFilterTest {

    /**
     * MockHttpServletRequest 没有 Content-Length 的 setter（只有 getter），
     * 所以直接覆写读法——这也更贴近真实：闸门看到的就是容器给的这个值。
     * declared = -1 表示分块传输（没有 Content-Length）。
     */
    private class SizedRequest(method: String, uri: String, private val declared: Long) :
        MockHttpServletRequest(method, uri) {
        override fun getContentLengthLong(): Long = declared
    }

    private val contentProperties = ContentProperties().apply { maxReadableBytes = 1_000 }
    private val filter = ContentPayloadSizeFilter(contentProperties, ObjectMapper())

    private fun run(method: String, uri: String, declaredLength: Long): Pair<MockHttpServletResponse, Boolean> {
        val response = MockHttpServletResponse()
        val chain = MockFilterChain()
        filter.doFilter(SizedRequest(method, uri, declaredLength), response, chain)
        return response to (chain.request != null)
    }

    @Test
    fun `rejects an oversized body before it is parsed`() {
        val (response, reachedChain) = run("PUT", "/api/papers/7/content", 5_000)

        assertFalse(reachedChain, "超限请求不该继续走到 Spring MVC（那时 body 已经被读进内存了）")
        assertEquals(HttpStatus.PAYLOAD_TOO_LARGE.value(), response.status)
        assertTrue(response.contentAsString.contains("\"code\":1014"), response.contentAsString)
    }

    @Test
    fun `lets a normal sized body through untouched`() {
        val (response, reachedChain) = run("PUT", "/api/papers/7/content", 900)

        assertTrue(reachedChain)
        assertEquals(HttpStatus.OK.value(), response.status)
        assertTrue(response.contentAsString.isEmpty(), "放行的请求不应写任何响应体")
    }

    @Test
    fun `ignores reads and other paths`() {
        // GET 没有请求体；其它路径不归这道闸门管（元数据 PATCH、上传等各有自己的额度判定）。
        assertTrue(run("GET", "/api/papers/7/content", 5_000).second)
        assertTrue(run("PUT", "/api/papers/7", 5_000).second)
        assertTrue(run("PUT", "/api/papers/7/content/extra", 5_000).second)
        // 分块传输没有 Content-Length：放行，由 Service 里的细判兜底。
        assertTrue(run("PUT", "/api/papers/7/content", -1).second)
    }

    @Test
    fun `handles a declared length beyond int range`() {
        // 超 2GB 的 body 只能走 Long 通道；确保判定不把它当成负数放过去。
        val (response, reachedChain) = run("PUT", "/api/papers/7/content", 5_000_000_000L)

        assertFalse(reachedChain)
        assertEquals(HttpStatus.PAYLOAD_TOO_LARGE.value(), response.status)
    }
}
