package org.paperreader.service

import com.sun.net.httpserver.HttpServer
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.io.TempDir
import org.paperreader.exception.FileTooLargeException
import org.paperreader.exception.NotPdfException
import org.paperreader.exception.UrlDownloadFailedException
import org.springframework.web.client.RestTemplate
import java.net.InetSocketAddress
import java.nio.file.Files
import java.nio.file.Path

/**
 * URL 导入论文（用户反馈「通过URL上传论文，解析失败」）的回归测试。
 *
 * 两个线上事故：① 本地存储下 storeFromUrl 返回相对路径，落库后下载时按 JVM 工作目录解析，
 * 必然 FileNotFoundException；② 下载器不校验内容，把 arXiv 的 HTML 落地页当 PDF 存成 .pdf。
 * 这里用真实 HttpServer 跑真实 IO，不打桩下载逻辑本身。
 */
class FileStorageServiceUrlImportTest {
    @TempDir
    lateinit var localDir: Path

    private var server: HttpServer? = null

    private val pdf = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n%%EOF\n".toByteArray()

    private val maxBytes = 10L * 1024 * 1024

    @AfterEach
    fun stopServer() {
        server?.stop(0)
    }

    private fun service() = FileStorageService("local", localDir.toString(), "http://127.0.0.1:1", RestTemplate())

    /** 起一个真实 HTTP 服务，返回它的 URL；同时把收到的请求头收进 [receivedHeaders]。 */
    private val receivedHeaders = mutableMapOf<String, String>()

    private fun serve(
        status: Int,
        contentType: String?,
        body: ByteArray,
        path: String = "/paper.pdf",
    ): String {
        val httpServer = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        httpServer.createContext("/") { exchange ->
            exchange.requestHeaders.forEach { (name, values) ->
                receivedHeaders[name.lowercase()] = values.firstOrNull() ?: ""
            }
            contentType?.let { exchange.responseHeaders.add("Content-Type", it) }
            exchange.sendResponseHeaders(status, body.size.toLong())
            exchange.responseBody.use { it.write(body) }
        }
        httpServer.start()
        server = httpServer
        return "http://127.0.0.1:${httpServer.address.port}$path"
    }

    @Test
    fun `local storage returns an absolute path that can be read back`() {
        val url = serve(200, "application/pdf", pdf)

        val (filePath, bytes) = service().storeFromUrl(url, 14, 25, maxBytes)

        assertTrue(Path.of(filePath).isAbsolute, "入库的必须是绝对路径，否则下载时按工作目录解析会找不到文件：$filePath")
        assertTrue(Files.exists(Path.of(filePath)), filePath)
        assertArrayEquals(pdf, bytes)
        assertArrayEquals(pdf, Files.readAllBytes(Path.of(filePath)))
    }

    @Test
    fun `sends a browser user agent so publishers do not reject the download`() {
        val url = serve(200, "application/pdf", pdf)

        service().storeFromUrl(url, 14, 25, maxBytes)

        assertTrue(receivedHeaders["user-agent"].orEmpty().contains("Mozilla"), receivedHeaders.toString())
    }

    @Test
    fun `rejects an html landing page and stores nothing`() {
        val url = serve(200, "text/html; charset=utf-8", "<!DOCTYPE html><html><body>paper</body></html>".toByteArray())

        val ex = assertThrows<NotPdfException> { service().storeFromUrl(url, 14, 25, maxBytes) }

        assertEquals(1017, ex.code)
        assertEquals(400, ex.httpStatus)
        assertFalse(Files.exists(localDir.resolve("14")), "校验没过就不该落盘")
    }

    @Test
    fun `rejects an html page that lies about its content type`() {
        val url = serve(200, "application/pdf", "<!DOCTYPE html><html></html>".toByteArray())

        val ex = assertThrows<NotPdfException> { service().storeFromUrl(url, 14, 25, maxBytes) }

        assertEquals(1017, ex.code)
        assertFalse(Files.exists(localDir.resolve("14")))
    }

    @Test
    fun `rejects a file over the per-file cap without storing it`() {
        val url = serve(200, "application/pdf", ByteArray(4096) + pdf)

        val ex = assertThrows<FileTooLargeException> { service().storeFromUrl(url, 14, 25, 1024) }

        assertEquals(1009, ex.code)
        assertEquals(413, ex.httpStatus)
        assertFalse(Files.exists(localDir.resolve("14")))
    }

    @Test
    fun `reports a failed download with a business error instead of a 500`() {
        val url = serve(404, "text/plain", "not found".toByteArray())

        val ex = assertThrows<UrlDownloadFailedException> { service().storeFromUrl(url, 14, 25, maxBytes) }

        assertEquals(1018, ex.code)
        assertEquals(400, ex.httpStatus)
        assertTrue(ex.message.contains("404"), ex.message)
    }

    @Test
    fun `follows a redirect to the real pdf`() {
        val target = serve(200, "application/pdf", pdf)
        val httpServer = server!!
        httpServer.createContext("/moved") { exchange ->
            exchange.responseHeaders.add("Location", target)
            exchange.sendResponseHeaders(302, -1)
            exchange.close()
        }

        val (filePath, bytes) = service().storeFromUrl(
            "http://127.0.0.1:${httpServer.address.port}/moved", 14, 25, maxBytes,
        )

        assertTrue(Path.of(filePath).isAbsolute, filePath)
        assertArrayEquals(pdf, bytes)
    }
}
