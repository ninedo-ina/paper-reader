package org.paperreader.config

import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.paperreader.dto.ApiResponse
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

/**
 * 正文字节数的第一道闸门（W9）：在请求体被 Jackson 解析**之前**按 Content-Length 判一次。
 *
 * 为什么服务里已经有体积判定，这里还要再来一道：
 * `PUT /api/papers/{id}/content` 的请求体是 JSON，Spring 没有任何默认上限
 * （`spring.servlet.multipart.*` 只管 multipart，`server.tomcat.max-http-form-post-size` 只管表单）。
 * 也就是说一个 500MB 的 body 会被完整读进内存、解析成 JsonNode，然后才轮到 Service 里的
 * `ensureWithin` 抛 1014——闸门开了，但内存已经付出去了。这条路径是每个登录用户都能反复触发的。
 *
 * 判定只用请求头，所以代价接近零。两道闸门是一致的两层：这里是 `maxReadableBytes`（粗筛，
 * 只挡"离谱地大"），Service 里是 `maxJsonBytes` / `maxHtmlBytes`（细判，会区分是正文还是渲染结果，
 * 并给出各自的上限）。分块传输（chunked）没有 Content-Length，这里放行、由 Service 兜底。
 *
 * 只拦这一个路径的 PUT，其余请求直接透传。
 */
@Component
class ContentPayloadSizeFilter(
    private val contentProperties: ContentProperties,
    private val objectMapper: ObjectMapper,
) : OncePerRequestFilter() {

    /** 只匹配 PUT /api/papers/{id}/content。 */
    private val contentWritePath = Regex("""^/api/papers/\d+/content$""")

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        if (request.method == HttpMethod.PUT.name() &&
            contentWritePath.matches(request.requestURI) &&
            request.contentLengthLong > contentProperties.maxReadableBytes
        ) {
            response.status = HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE
            response.contentType = MediaType.APPLICATION_JSON_VALUE
            response.characterEncoding = Charsets.UTF_8.name()
            objectMapper.writeValue(
                response.writer,
                ApiResponse<Unit>(
                    code = 1014,
                    message = "正文请求体过大，已被服务端拒绝（上限 ${contentProperties.maxReadableBytes} 字节）",
                ),
            )
            return
        }
        filterChain.doFilter(request, response)
    }
}
