package org.paperreader.service

import org.paperreader.exception.BusinessException
import org.paperreader.exception.FileTooLargeException
import org.paperreader.exception.NotPdfException
import org.paperreader.exception.UrlDownloadFailedException
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.RequestEntity
import org.springframework.stereotype.Service
import org.springframework.web.client.RestTemplate
import org.springframework.web.client.HttpClientErrorException
import org.springframework.core.io.ByteArrayResource
import org.springframework.core.io.FileSystemResource
import org.springframework.core.io.Resource
import org.springframework.web.multipart.MultipartFile
import java.net.HttpURLConnection
import java.net.URI
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths
import java.util.*

@Service
class FileStorageService(
    @Value("\${app.storage.type}") private val storageType: String,
    @Value("\${app.storage.local-path}") private val localPath: String,
    @Value("\${app.dufs.url}") private val dufsUrl: String,
    private val restTemplate: RestTemplate,
) {
    private val logger = LoggerFactory.getLogger(FileStorageService::class.java)

    fun store(file: MultipartFile, userId: Long, paperId: Long): String {
        val extension = file.originalFilename?.substringAfterLast('.', "") ?: "pdf"
        val objectPath = "$userId/$paperId/${UUID.randomUUID()}.$extension"

        return when (storageType) {
            "local" -> {
                val target = Paths.get(localPath, objectPath)
                Files.createDirectories(target.parent)
                file.transferTo(target)
                target.toString()
            }
            else -> {
                ensureDufsDirectory(objectPath)
                val req = RequestEntity.put(URI("$dufsUrl/$objectPath"))
                    .body(file.bytes)
                restTemplate.exchange(req, Void::class.java)
                objectPath
            }
        }.also { logger.info("Stored file: {}", it) }
    }

    /**
     * 落盘一段已有字节（调用方给完整对象路径，如 `feedback/42/<uuid>.png`）。
     * 与 [store] 的区别只是入口：论文上传拿的是 MultipartFile、且路径由 userId/paperId 拼；
     * 反馈截图要自己定路径、且已经读成字节校验过大小。存储后端（local/dufs）走同一套开关。
     */
    fun storeBytes(objectPath: String, bytes: ByteArray): String {
        return when (storageType) {
            "local" -> {
                val target = Paths.get(localPath, objectPath)
                Files.createDirectories(target.parent)
                Files.write(target, bytes)
                target.toString()
            }
            else -> {
                ensureDufsDirectory(objectPath)
                val req = RequestEntity.put(URI("$dufsUrl/$objectPath")).body(bytes)
                restTemplate.exchange(req, Void::class.java)
                objectPath
            }
        }.also { logger.info("Stored file: {}", it) }
    }

    /**
     * 从 URL 下载并落盘。maxBytes 是硬上限：下载时就按它截断，超了直接抛 FileTooLargeException，
     * 不能先读完整包再校验——URL 由用户给，不设上限就是一个"让服务器把任意大小文件读进内存"的口子。
     *
     * 返回值与 [store]/[storeBytes] 同一约定：local 返回绝对路径，dufs 返回对象路径。
     */
    fun storeFromUrl(url: String, userId: Long, paperId: Long, maxBytes: Long): Pair<String, ByteArray> {
        val bytes = downloadPdf(url, maxBytes)
        val objectPath = "$userId/$paperId/${UUID.randomUUID()}.pdf"

        val storedPath = when (storageType) {
            "local" -> {
                val target = Paths.get(localPath, objectPath)
                Files.createDirectories(target.parent)
                Files.write(target, bytes)
                target.toString()
            }
            else -> {
                ensureDufsDirectory(objectPath)
                val req = RequestEntity.put(URI("$dufsUrl/$objectPath"))
                    .body(bytes)
                restTemplate.exchange(req, Void::class.java)
                objectPath
            }
        }

        logger.info("Stored file from URL: {}", storedPath)
        return storedPath to bytes
    }

    fun read(filePath: String): ByteArray {
        return when (storageType) {
            "local" -> Files.readAllBytes(Path.of(filePath))
            else -> {
                val req = RequestEntity.get(URI("$dufsUrl/$filePath")).build()
                restTemplate.exchange(req, ByteArray::class.java).body!!
            }
        }
    }

    /** Return a Spring Resource for Range-request-friendly download. Local uses FileSystemResource (efficient random access), dufs falls back to ByteArrayResource (in-memory). */
    fun readAsResource(filePath: String): Resource {
        return when (storageType) {
            "local" -> FileSystemResource(Path.of(filePath))
            else -> ByteArrayResource(read(filePath))
        }
    }

    fun fileSize(filePath: String): Long {
        return when (storageType) {
            "local" -> Files.size(Path.of(filePath))
            else -> read(filePath).size.toLong()
        }
    }

    fun delete(filePath: String): Boolean {
        try {
            when (storageType) {
                "local" -> Files.deleteIfExists(Path.of(filePath))
                else -> {
                    restTemplate.exchange(
                        RequestEntity.delete(URI("$dufsUrl/$filePath")).build(),
                        Void::class.java,
                    )
                }
            }
            return true
        } catch (e: Exception) {
            if (e is HttpClientErrorException.NotFound) {
                logger.info("File was already absent: {}", filePath)
                return true
            }
            logger.warn("Failed to delete file: {}", filePath, e)
            return false
        }
    }

    /**
     * dufs 不会自动创建中间目录，PUT 到不存在的路径会返回 404。
     * RestTemplate.put 会标准化 URI 去掉尾部斜杠，导致 dufs 创建文件而非目录。
     * 这里用 Java 11+ HttpClient 发 MKCOL（WebDAV 创建目录）。
     */
    private val mkcolClient = java.net.http.HttpClient.newHttpClient()

    private fun ensureDufsDirectory(objectPath: String) {
        val parts = objectPath.split("/")
        var current = StringBuilder()
        for (part in parts.dropLast(1)) {
            current.append(part).append("/")
            val dirUrl = "$dufsUrl/$current"
            try {
                val req = java.net.http.HttpRequest.newBuilder()
                    .uri(URI.create(dirUrl))
                    .method("MKCOL", java.net.http.HttpRequest.BodyPublishers.noBody())
                    .build()
                val resp = mkcolClient.send(req, java.net.http.HttpResponse.BodyHandlers.discarding())
                logger.debug("MKCOL {} -> {}", dirUrl, resp.statusCode())
            } catch (_: Exception) {
                // 目录已存在或网络异常均忽略，后续 PUT 会暴露真正的问题
            }
        }
    }

    /**
     * 下载用户给的 URL。三个坑都在这里堵：
     * ① 不带 User-Agent 会被 arXiv 之类的站点挡（或返回 HTML）；
     * ② 不校验内容就落盘，会把 HTML 落地页存成 .pdf（用户反馈的「URL解析失败」）；
     * ③ 不设超时会被慢站拖住工作线程。
     */
    private fun downloadPdf(url: String, maxBytes: Long): ByteArray {
        val target = ArxivPdfUrl.normalize(url)
        val connection = try {
            (URI(target).toURL().openConnection() as HttpURLConnection).apply {
                instanceFollowRedirects = true
                connectTimeout = CONNECT_TIMEOUT_MS
                readTimeout = READ_TIMEOUT_MS
                setRequestProperty("User-Agent", USER_AGENT)
                setRequestProperty("Accept", "application/pdf,*/*")
            }
        } catch (e: Exception) {
            throw UrlDownloadFailedException("无法访问该链接：${e.message}")
        }

        try {
            val status = connection.responseCode
            if (status !in 200..299) {
                throw UrlDownloadFailedException("无法从该链接下载文件（HTTP $status）")
            }
            // 声明的大小先判一次，省得为一个必然被拒的文件把字节读进内存。
            val declared = connection.contentLengthLong
            if (declared > maxBytes) throw FileTooLargeException(declared, maxBytes)

            val bytes = connection.inputStream.use { readAtMost(it, maxBytes) }
            if (!hasPdfHeader(bytes)) throw NotPdfException()
            return bytes
        } catch (e: BusinessException) {
            throw e
        } catch (e: Exception) {
            throw UrlDownloadFailedException("无法从该链接下载文件：${e.message}")
        } finally {
            connection.disconnect()
        }
    }

    /** 边读边卡上限：响应可能是 chunked（没有 Content-Length），不能只靠声明值。 */
    private fun readAtMost(input: java.io.InputStream, maxBytes: Long): ByteArray {
        val buffer = ByteArray(64 * 1024)
        val out = java.io.ByteArrayOutputStream()
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            out.write(buffer, 0, read)
            if (out.size() > maxBytes) throw FileTooLargeException(out.size().toLong(), maxBytes)
        }
        return out.toByteArray()
    }

    /** PDF 头允许出现在文件开头 1KB 内（规范如此，有些生成器会先塞几个字节）。 */
    private fun hasPdfHeader(bytes: ByteArray): Boolean {
        val window = String(bytes, 0, minOf(bytes.size, PDF_HEADER_WINDOW), Charsets.ISO_8859_1)
        return window.contains("%PDF-")
    }

    companion object {
        /** 慢站在没有超时的连接上能占住工作线程，必要时给用户一个明确的失败。 */
        private const val CONNECT_TIMEOUT_MS = 10_000
        private const val READ_TIMEOUT_MS = 30_000
        private const val PDF_HEADER_WINDOW = 1024

        /** 站点按 UA 区分「浏览器」和「脚本」，默认的 Java UA 常被 403 或换成 HTML 页面。 */
        private const val USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
                "Chrome/152.0.0.0 Safari/537.36"
    }
}

/**
 * arXiv 的 /html/<id>、/abs/<id> 是网页，同一篇的 PDF 在 /pdf/<id> 下。
 * 用户从浏览器地址栏复制过来的多半就是 /html/ 或 /abs/，直接下只会得到 HTML。
 */
internal object ArxivPdfUrl {
    private val PAPER_PAGE = Regex("^/(?:html|abs)/(.+)$")

    fun normalize(url: String): String {
        val uri = try {
            URI(url)
        } catch (_: Exception) {
            return url
        }
        if (uri.host?.let { it.equals("arxiv.org", ignoreCase = true) || it.equals("www.arxiv.org", ignoreCase = true) } != true) {
            return url
        }
        val id = PAPER_PAGE.find(uri.rawPath ?: return url)?.groupValues?.get(1)?.removeSuffix("/") ?: return url
        if (id.isEmpty()) return url
        return try {
            URI(uri.scheme, uri.authority, "/pdf/$id", uri.rawQuery, uri.rawFragment).toString()
        } catch (_: Exception) {
            url
        }
    }
}
