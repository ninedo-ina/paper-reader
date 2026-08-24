package org.paperreader.service

import org.paperreader.dto.ProviderRelayChatRequest
import org.paperreader.dto.ProviderRelayModelsRequest
import org.paperreader.exception.BusinessException
import org.paperreader.exception.InvalidParameterException
import org.slf4j.LoggerFactory
import org.springframework.core.io.buffer.DataBuffer
import org.springframework.core.io.buffer.DataBufferUtils
import org.springframework.core.io.buffer.DefaultDataBufferFactory
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.http.client.reactive.ReactorClientHttpConnector
import org.springframework.stereotype.Service
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.WebClientResponseException
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody
import reactor.core.publisher.Flux
import reactor.netty.http.client.HttpClient
import java.net.Inet6Address
import java.net.InetAddress
import java.net.URI
import java.time.Duration

@Service
class ProviderRelayService {
    private val logger = LoggerFactory.getLogger(ProviderRelayService::class.java)
    private val webClient = WebClient.builder()
        .clientConnector(
            ReactorClientHttpConnector(
                HttpClient.create()
                    .followRedirect(false)
                    .option(io.netty.channel.ChannelOption.CONNECT_TIMEOUT_MILLIS, CONNECT_TIMEOUT_MS)
                    .responseTimeout(Duration.ofMillis(RESPONSE_TIMEOUT_MS))
            )
        )
        .build()

    fun forwardModels(
        request: ProviderRelayModelsRequest,
    ): ResponseEntity<StreamingResponseBody> {
        val target = ProviderRelayTargetValidator.target(request.baseUrl, "models")
        validateApiKey(request.apiKey)

        val upstream = exchange("models") {
            webClient.get()
                .uri(target)
                .headers { headers: HttpHeaders -> applyAuthorization(headers, request.apiKey) }
                .retrieve()
                .toEntityFlux(DataBuffer::class.java)
        }
        return toResponseEntity(upstream)
    }

    fun forwardChat(
        request: ProviderRelayChatRequest,
    ): ResponseEntity<StreamingResponseBody> {
        val target = ProviderRelayTargetValidator.target(request.baseUrl, "chat/completions")
        validateApiKey(request.apiKey)
        validateChatRequest(request)

        val upstream = exchange("chat") {
            webClient.post()
                .uri(target)
                .headers { headers: HttpHeaders ->
                    applyAuthorization(headers, request.apiKey)
                    headers.contentType = MediaType.APPLICATION_JSON
                }
                .bodyValue(
                    mapOf(
                        "model" to request.model,
                        "messages" to request.messages,
                        "stream" to request.stream,
                    )
                )
                .retrieve()
                .toEntityFlux(DataBuffer::class.java)
        }
        return toResponseEntity(upstream)
    }

    private fun exchange(
        operation: String,
        request: () -> reactor.core.publisher.Mono<ResponseEntity<Flux<DataBuffer>>>,
    ): ResponseEntity<Flux<DataBuffer>> {
        try {
            return request().block()
                ?: throw ProviderRelayException("Provider 中继没有收到上游响应")
        } catch (ex: WebClientResponseException) {
            // retrieve() raises non-2xx responses as an exception. Preserve the
            // upstream status/body so the browser can distinguish a bad API
            // path (404/405) from authentication or model errors.
            logger.warn(
                "Provider relay {} received upstream HTTP {}",
                operation,
                ex.statusCode.value(),
            )
            return ResponseEntity.status(ex.statusCode)
                .headers(copyResponseHeaders(ex.headers))
                .body(
                    Flux.just(
                        DefaultDataBufferFactory.sharedInstance.wrap(ex.responseBodyAsByteArray),
                    ),
                )
        } catch (ex: Exception) {
            logger.warn("Provider relay {} failed before response: {}", operation, ex.javaClass.simpleName)
            if (ex is ProviderRelayException) throw ex
            throw ProviderRelayException()
        }
    }

    private fun toResponseEntity(
        upstream: ResponseEntity<Flux<DataBuffer>>,
    ): ResponseEntity<StreamingResponseBody> {
        val body = upstream.body ?: Flux.empty()
        val streamingBody = StreamingResponseBody { output ->
            try {
                body.doOnNext { buffer: DataBuffer -> writeBuffer(buffer, output) }.blockLast()
            } catch (ex: Exception) {
                logger.warn("Provider relay stream failed: {}", ex.javaClass.simpleName)
            }
        }
        return ResponseEntity.status(upstream.statusCode)
            .headers(copyResponseHeaders(upstream.headers))
            .body(streamingBody)
    }

    private fun writeBuffer(buffer: DataBuffer, output: java.io.OutputStream) {
        try {
            val bytes = ByteArray(buffer.readableByteCount())
            buffer.read(bytes)
            output.write(bytes)
            output.flush()
        } finally {
            DataBufferUtils.release(buffer)
        }
    }

    private fun copyResponseHeaders(
        upstreamHeaders: HttpHeaders,
    ): HttpHeaders = HttpHeaders().also { headers ->
        headers.contentType = upstreamHeaders.contentType ?: MediaType.APPLICATION_OCTET_STREAM
        upstreamHeaders.cacheControl
            ?.takeIf { it.isNotBlank() }
            ?.let { headers.cacheControl = it }
    }

    private fun applyAuthorization(headers: HttpHeaders, apiKey: String) {
        if (apiKey.isNotBlank()) headers.setBearerAuth(apiKey.trim())
    }

    private fun validateApiKey(apiKey: String) {
        if (apiKey.length > MAX_API_KEY_LENGTH) {
            throw InvalidParameterException("API Key 长度无效")
        }
    }

    private fun validateChatRequest(request: ProviderRelayChatRequest) {
        if (request.model.isBlank() || request.model.length > MAX_MODEL_LENGTH) {
            throw InvalidParameterException("模型名称无效")
        }
        if (request.messages.isEmpty() || request.messages.size > MAX_MESSAGE_COUNT) {
            throw InvalidParameterException("消息数量无效")
        }
        if (request.messages.any { it.role !in ALLOWED_ROLES || it.content.length > MAX_MESSAGE_LENGTH }) {
            throw InvalidParameterException("消息内容无效")
        }
        if (request.messages.sumOf { it.content.length.toLong() } > MAX_TOTAL_MESSAGE_LENGTH) {
            throw InvalidParameterException("对话上下文过长")
        }
    }

    companion object {
        private const val CONNECT_TIMEOUT_MS = 10_000
        private const val RESPONSE_TIMEOUT_MS = 120_000L
        private const val MAX_API_KEY_LENGTH = 4_096
        private const val MAX_MODEL_LENGTH = 256
        private const val MAX_MESSAGE_COUNT = 100
        private const val MAX_MESSAGE_LENGTH = 500_000
        private const val MAX_TOTAL_MESSAGE_LENGTH = 4_000_000L
        private val ALLOWED_ROLES = setOf("system", "user", "assistant")
    }
}

private class ProviderRelayException(
    message: String = "Provider 中继无法连接上游服务",
) : BusinessException(5020, message, 502)

internal object ProviderRelayTargetValidator {
    private val endpointSuffix = Regex("/(?:models|chat/completions)$", RegexOption.IGNORE_CASE)

    fun target(value: String, endpoint: String): URI {
        val parsed = try {
            URI(value.trim())
        } catch (_: Exception) {
            throw InvalidParameterException("Provider Base URL 格式无效")
        }

        validate(parsed)
        val basePath = parsed.rawPath.orEmpty().trimEnd('/').replace(endpointSuffix, "")
        return try {
            URI(
                parsed.scheme,
                parsed.rawAuthority,
                "${basePath}/$endpoint",
                parsed.rawQuery,
                null,
            )
        } catch (_: Exception) {
            throw InvalidParameterException("Provider Base URL 格式无效")
        }
    }

    private fun validate(uri: URI) {
        if (!uri.scheme.equals("https", ignoreCase = true)) {
            throw InvalidParameterException("Provider Base URL 只支持 HTTPS")
        }
        if (uri.host.isNullOrBlank() || uri.userInfo != null || uri.fragment != null) {
            throw InvalidParameterException("Provider Base URL 必须是公开的 HTTPS 地址")
        }

        val host = uri.host.lowercase()
        if (host == "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
            throw InvalidParameterException("Provider Base URL 不允许使用本地地址")
        }

        val addresses = try {
            InetAddress.getAllByName(uri.host)
        } catch (_: Exception) {
            throw InvalidParameterException("Provider 主机无法解析")
        }
        if (addresses.isEmpty() || addresses.any(::isNonPublicAddress)) {
            throw InvalidParameterException("Provider Base URL 不允许使用内网或本机地址")
        }
    }

    private fun isNonPublicAddress(address: InetAddress): Boolean {
        if (
            address.isAnyLocalAddress ||
            address.isLoopbackAddress ||
            address.isLinkLocalAddress ||
            address.isSiteLocalAddress ||
            address.isMulticastAddress
        ) return true

        val bytes = address.address.map { it.toInt() and 0xff }
        if (bytes.size == 4) {
            val first = bytes[0]
            val second = bytes[1]
            return first == 0 ||
                first == 10 ||
                first == 100 && second in 64..127 ||
                first == 127 ||
                first == 169 && second == 254 ||
                first == 172 && second in 16..31 ||
                first == 192 && second == 0 ||
                first == 192 && second == 168 ||
                first == 198 && second in 18..19 ||
                first == 198 && second == 51 && bytes[2] == 100 ||
                first == 203 && second == 0 && bytes[2] == 113 ||
                first >= 224
        }

        if (address is Inet6Address) {
            val first = bytes.firstOrNull() ?: return true
            val second = bytes.getOrNull(1) ?: return true
            if (
                first and 0xfe == 0xfc ||
                first == 0xfe && second and 0xc0 == 0x80 ||
                bytes.take(4) == listOf(0x20, 0x01, 0x0d, 0xb8)
            ) {
                return true
            }
        }
        return false
    }
}
