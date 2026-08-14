package org.paperreader.service

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.RequestEntity
import org.springframework.stereotype.Service
import org.springframework.web.client.RestTemplate
import org.springframework.core.io.ByteArrayResource
import org.springframework.core.io.FileSystemResource
import org.springframework.core.io.Resource
import org.springframework.web.multipart.MultipartFile
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

    fun storeFromUrl(url: String, userId: Long, paperId: Long): Pair<String, ByteArray> {
        val bytes = downloadPdf(url)
        val objectPath = "$userId/$paperId/${UUID.randomUUID()}.pdf"

        when (storageType) {
            "local" -> {
                val target = Paths.get(localPath, objectPath)
                Files.createDirectories(target.parent)
                Files.write(target, bytes)
            }
            else -> {
                ensureDufsDirectory(objectPath)
                val req = RequestEntity.put(URI("$dufsUrl/$objectPath"))
                    .body(bytes)
                restTemplate.exchange(req, Void::class.java)
            }
        }

        logger.info("Stored file from URL: {}", objectPath)
        return objectPath to bytes
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

    fun delete(filePath: String) {
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
        } catch (e: Exception) {
            logger.warn("Failed to delete file: {}", filePath, e)
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

    private fun downloadPdf(url: String): ByteArray {
        return try {
            URI(url).toURL().openStream().use { it.readAllBytes() }
        } catch (e: Exception) {
            throw RuntimeException("Failed to download PDF from URL: ${e.message}")
        }
    }
}
