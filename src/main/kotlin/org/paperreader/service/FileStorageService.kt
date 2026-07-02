package org.paperreader.service

import io.minio.*
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile
import java.io.ByteArrayInputStream
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths
import java.util.*

@Service
class FileStorageService(
    @Value("\${app.storage.type}") private val storageType: String,
    @Value("\${app.storage.local-path}") private val localPath: String,
    private val minioClient: MinioClient,
    @Value("\${app.minio.bucket}") private val bucket: String,
) {
    private val logger = LoggerFactory.getLogger(FileStorageService::class.java)

    fun store(file: MultipartFile, userId: Long, paperId: Long): String {
        val extension = file.originalFilename?.substringAfterLast('.', "") ?: "pdf"
        val objectPath = "$userId/$paperId/${UUID.randomUUID()}.$extension"

        return when (storageType) {
            "local" -> {
                val targetPath = Paths.get(localPath, objectPath)
                Files.createDirectories(targetPath.parent)
                file.transferTo(targetPath)
                targetPath.toString()
            }
            else -> {
                ensureBucket()
                minioClient.putObject(
                    PutObjectArgs.builder()
                        .bucket(bucket)
                        .`object`(objectPath)
                        .stream(file.inputStream, file.size, -1)
                        .contentType(file.contentType ?: "application/pdf")
                        .build()
                )
                objectPath
            }
        }.also { logger.info("Stored file: {}", it) }
    }

    fun storeFromUrl(url: String, userId: Long, paperId: Long): Pair<String, ByteArray> {
        val bytes = downloadPdf(url)
        val objectPath = "$userId/$paperId/${UUID.randomUUID()}.pdf"

        when (storageType) {
            "local" -> {
                val targetPath = Paths.get(localPath, objectPath)
                Files.createDirectories(targetPath.parent)
                Files.write(targetPath, bytes)
            }
            else -> {
                ensureBucket()
                minioClient.putObject(
                    PutObjectArgs.builder()
                        .bucket(bucket)
                        .`object`(objectPath)
                        .stream(ByteArrayInputStream(bytes), bytes.size.toLong(), -1)
                        .contentType("application/pdf")
                        .build()
                )
            }
        }

        logger.info("Stored file from URL: {}", objectPath)
        return objectPath to bytes
    }

    fun read(filePath: String): ByteArray {
        return when (storageType) {
            "local" -> Files.readAllBytes(Path.of(filePath))
            else -> {
                minioClient.getObject(
                    GetObjectArgs.builder().bucket(bucket).`object`(filePath).build()
                ).use { it.readAllBytes() }
            }
        }
    }

    fun delete(filePath: String) {
        try {
            when (storageType) {
                "local" -> Files.deleteIfExists(Path.of(filePath))
                else -> minioClient.removeObject(
                    RemoveObjectArgs.builder().bucket(bucket).`object`(filePath).build()
                )
            }
        } catch (e: Exception) {
            logger.warn("Failed to delete file: {}", filePath, e)
        }
    }

    private fun ensureBucket() {
        try {
            val found = minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucket).build())
            if (!found) {
                minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucket).build())
            }
        } catch (e: Exception) {
            logger.warn("MinIO bucket check failed: {}", e.message)
        }
    }

    private fun downloadPdf(url: String): ByteArray {
        return try {
            java.net.URI(url).toURL().openStream().use { it.readAllBytes() }
        } catch (e: Exception) {
            throw RuntimeException("Failed to download PDF from URL: ${e.message}")
        }
    }
}
