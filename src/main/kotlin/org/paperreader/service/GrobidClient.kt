package org.paperreader.service

import org.paperreader.config.GrobidConfig
import org.slf4j.LoggerFactory
import org.springframework.core.io.ByteArrayResource
import org.springframework.http.*
import org.springframework.stereotype.Service
import org.springframework.util.LinkedMultiValueMap
import org.springframework.web.client.RestTemplate

@Service
class GrobidClient(
    private val config: GrobidConfig,
    private val restTemplate: RestTemplate,
) {
    private val logger = LoggerFactory.getLogger(GrobidClient::class.java)

    companion object {
        const val CONSOLIDATE_HEADER = 1
        const val CONSOLIDATE_CITATION = 2
    }

    fun processHeader(pdfBytes: ByteArray, consolidate: Int = CONSOLIDATE_HEADER): String {
        val body = buildMultipartBody(pdfBytes, "processHeaderDocument", listOf(
            "consolidateHeader" to consolidate.toString(),
        ))
        return call(body)
    }

    fun processFulltext(pdfBytes: ByteArray, consolidate: Int = CONSOLIDATE_HEADER + CONSOLIDATE_CITATION): String {
        val body = buildMultipartBody(pdfBytes, "processFulltextDocument", listOf(
            "consolidateHeader" to consolidate.toString(),
        ))
        return call(body)
    }

    fun processReferences(pdfBytes: ByteArray, consolidate: Int = CONSOLIDATE_CITATION): String {
        val body = buildMultipartBody(pdfBytes, "processReferences", listOf(
            "consolidateHeader" to consolidate.toString(),
        ))
        return call(body)
    }

    fun processCitation(citation: String, consolidate: Int = CONSOLIDATE_CITATION): String {
        val body = LinkedMultiValueMap<String, Any>()
        body.add("citations", citation)
        body.add("consolidateCitations", consolidate.toString())

        val headers = HttpHeaders()
        headers.contentType = MediaType.MULTIPART_FORM_DATA
        headers.accept = listOf(MediaType.APPLICATION_XML, MediaType.TEXT_XML, MediaType.ALL)

        return call(HttpEntity(body, headers))
    }

    fun isHealthy(): Boolean = try {
        restTemplate.getForEntity("${config.baseUrl}/api/isalive", Void::class.java)
            .statusCode.is2xxSuccessful
    } catch (e: Exception) {
        logger.warn("GROBID health check failed: {}", e.message)
        false
    }

    private fun call(request: HttpEntity<LinkedMultiValueMap<String, Any>>): String {
        val url = "${config.baseUrl}/api/service"
        logger.debug("Calling GROBID at {}", url)
        val response: ResponseEntity<String> = restTemplate.exchange(
            url,
            HttpMethod.POST,
            request,
            String::class.java,
        )
        if (!response.statusCode.is2xxSuccessful) {
            throw RuntimeException("GROBID request failed: ${response.statusCode}")
        }
        return response.body ?: throw RuntimeException("GROBID returned empty body")
    }

    private fun buildMultipartBody(
        pdfBytes: ByteArray,
        segment: String,
        extraParams: List<Pair<String, String>>,
    ): HttpEntity<LinkedMultiValueMap<String, Any>> {
        val body = LinkedMultiValueMap<String, Any>()

        val part = ByteArrayResource(pdfBytes, "form-data; name=\"input\"; filename=\"paper.pdf\"")

        val headers = HttpHeaders()
        headers.contentType = MediaType.MULTIPART_FORM_DATA
        headers.accept = listOf(MediaType.APPLICATION_XML, MediaType.TEXT_XML, MediaType.ALL)

        body.add("input", part)
        body.add("segment", segment)
        extraParams.forEach { (k, v) -> body.add(k, v) }

        return HttpEntity(body, headers)
    }
}
