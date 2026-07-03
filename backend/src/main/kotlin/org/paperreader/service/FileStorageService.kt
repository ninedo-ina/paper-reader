package org.paperreader.service

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpMethod
import org.springframework.http.RequestEntity
import org.springframework.stereotype.Service
import org.springframework.web.client.RestTemplate
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

    private fun downloadPdf(url: String): ByteArray {
        return try {
            URI(url).toURL().openStream().use { it.readAllBytes() }
        } catch (e: Exception) {
            throw RuntimeException("Failed to download PDF from URL: ${e.message}")
        }
    }
}
