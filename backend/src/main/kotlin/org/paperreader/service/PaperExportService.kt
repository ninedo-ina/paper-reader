package org.paperreader.service

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import org.paperreader.config.ExportProperties
import org.paperreader.dto.CreateExportRequest
import org.paperreader.dto.ExportArtifactDto
import org.paperreader.dto.ExportCapabilitiesDto
import org.paperreader.dto.ExportFormatDto
import org.paperreader.dto.ImportMarkdownRequest
import org.paperreader.dto.ImportResultDto
import org.paperreader.exception.ExportFailedException
import org.paperreader.exception.InvalidParameterException
import org.paperreader.exception.ResourceNotFoundException
import org.paperreader.model.PaperExportArtifact
import org.paperreader.repository.PaperExportArtifactRepository
import org.paperreader.repository.PaperRepository
import org.paperreader.repository.PaperVersionRepository
import org.slf4j.LoggerFactory
import org.springframework.core.io.FileSystemResource
import org.springframework.core.io.Resource
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.nio.file.Files
import java.nio.file.Path
import java.util.UUID

/**
 * 论文导出/导入编排 / Paper export & import orchestration。
 *
 * 引擎（子进程 + 五道闸门）在 [DocumentExportEngine]；本服务负责鉴权、取正文/参考文献、
 * 产物落盘、把产物「回挂」到版本记录（[PaperExportArtifact].versionId → pr_paper_versions），
 * 以及同 (paper, version, format) 只留最新一份的产物保留策略。
 */
@Service
class PaperExportService(
    private val paperRepository: PaperRepository,
    private val paperVersionRepository: PaperVersionRepository,
    private val artifactRepository: PaperExportArtifactRepository,
    private val engine: DocumentExportEngine,
    private val objectMapper: ObjectMapper,
    private val auditLogService: AuditLogService,
    private val props: ExportProperties,
) {
    private val logger = LoggerFactory.getLogger(PaperExportService::class.java)

    fun getCapabilities(): ExportCapabilitiesDto = ExportCapabilitiesDto(
        formats = ExportFormat.entries.map {
            ExportFormatDto(id = it.id, ext = it.ext, available = engine.isAvailable(it))
        },
        importAvailable = engine.isImportAvailable(),
    )

    @Transactional
    fun export(paperId: Long, userId: Long, request: CreateExportRequest): ExportArtifactDto {
        val paper = paperRepository.findByIdAndUserId(paperId, userId)
            ?: throw ResourceNotFoundException("Paper", paperId)

        val format = ExportFormat.fromId(request.format)
            ?: throw InvalidParameterException("不支持的导出格式：${request.format}")

        val versionId = request.versionId?.also {
            val version = paperVersionRepository.findById(it).orElse(null)
            if (version == null || version.paperId != paperId) {
                throw InvalidParameterException("版本不存在或不属于该论文")
            }
        }

        val cslJson = if (format == ExportFormat.BIBTEX) {
            extractCslJson(paper.contentJson?.let { objectMapper.readTree(it) })
        } else {
            null
        }

        val bytes = engine.export(format, paper.contentHtml, cslJson, paper.title)

        // 同 (paper, version, format) 只留最新一份：先清旧产物（磁盘 + 行），避免无界增长。
        val stale = if (versionId == null) {
            artifactRepository.findByPaperIdAndVersionIdIsNullAndFormat(paperId, format.id)
        } else {
            artifactRepository.findByPaperIdAndVersionIdAndFormat(paperId, versionId, format.id)
        }
        stale.forEach { deleteArtifactFile(it.filePath) }
        if (stale.isNotEmpty()) artifactRepository.deleteAll(stale)

        val relativePath = persistArtifact(paperId, format, bytes)
        val saved = artifactRepository.save(
            PaperExportArtifact(
                paperId = paperId,
                versionId = versionId,
                format = format.id,
                engine = if (format.needsTypst) "pandoc+typst" else "pandoc",
                filePath = relativePath,
                byteSize = bytes.size.toLong(),
                contentVersion = paper.contentVersion,
                status = "success",
                createdBy = userId,
            )
        )
        auditLogService.log(userId, "导出${format.id}", paper.title.take(255))
        return saved.toDto()
    }

    fun listArtifacts(paperId: Long, userId: Long): List<ExportArtifactDto> {
        paperRepository.findByIdAndUserId(paperId, userId)
            ?: throw ResourceNotFoundException("Paper", paperId)
        return artifactRepository.findByPaperIdOrderByCreatedAtDesc(paperId).map { it.toDto() }
    }

    /** 返回 (下载文件名, 资源) 供控制器流式回传。 */
    fun downloadArtifact(paperId: Long, artifactId: Long, userId: Long): Triple<String, String, Resource> {
        val paper = paperRepository.findByIdAndUserId(paperId, userId)
            ?: throw ResourceNotFoundException("Paper", paperId)
        val artifact = artifactRepository.findByIdAndPaperId(artifactId, paperId)
            ?: throw ResourceNotFoundException("ExportArtifact", artifactId)
        val format = ExportFormat.fromId(artifact.format) ?: throw ResourceNotFoundException("ExportArtifact", artifactId)
        val relative = artifact.filePath ?: throw ResourceNotFoundException("ExportArtifact", artifactId)

        val root = outputRoot()
        val file = root.resolve(relative).normalize()
        if (!file.startsWith(root) || !Files.exists(file)) {
            logger.warn("Export artifact file missing: id={} paper={}", artifactId, paperId)
            throw ResourceNotFoundException("ExportArtifact", artifactId)
        }
        val filename = "${safeFileName(paper.title)}.${format.ext}"
        return Triple(filename, format.mediaType, FileSystemResource(file))
    }

    fun importMarkdown(paperId: Long, userId: Long, request: ImportMarkdownRequest): ImportResultDto {
        paperRepository.findByIdAndUserId(paperId, userId)
            ?: throw ResourceNotFoundException("Paper", paperId)
        if (request.markdown.isBlank()) throw InvalidParameterException("导入内容为空")
        val html = engine.importMarkdown(request.markdown)
        auditLogService.log(userId, "导入markdown", "paper#$paperId")
        return ImportResultDto(contentHtml = html)
    }

    // ---------------------------------------------------------------- helpers

    /** 从 content_json 递归收集所有 Bibliography 节点的 CSL-JSON 条目，拼成一个 JSON 数组字符串。 */
    fun extractCslJson(root: JsonNode?): String? {
        if (root == null) return null
        val items = objectMapper.createArrayNode()
        fun walk(node: JsonNode) {
            when {
                node.isObject -> {
                    val entries = node.get("attrs")?.get("entries")
                    if (entries != null && entries.isArray) {
                        entries.forEach { if (it.isObject) items.add(it) }
                    }
                    node.fields().forEach { walk(it.value) }
                }
                node.isArray -> node.forEach { walk(it) }
            }
        }
        walk(root)
        return if (items.isEmpty) null else objectMapper.writeValueAsString(items)
    }

    private fun persistArtifact(paperId: Long, format: ExportFormat, bytes: ByteArray): String {
        val dir = outputRoot().resolve(paperId.toString())
        Files.createDirectories(dir)
        val fileName = "${UUID.randomUUID()}.${format.ext}"
        val target = dir.resolve(fileName)
        try {
            Files.write(target, bytes)
        } catch (e: Exception) {
            logger.warn("Failed to persist export artifact: {}", e.javaClass.simpleName)
            throw ExportFailedException()
        }
        return "$paperId/$fileName"
    }

    private fun deleteArtifactFile(relative: String?) {
        if (relative.isNullOrBlank()) return
        val file = outputRoot().resolve(relative).normalize()
        if (file.startsWith(outputRoot())) {
            runCatching { Files.deleteIfExists(file) }
                .onFailure { logger.debug("stale artifact delete failed: {}", it.javaClass.simpleName) }
        }
    }

    private fun outputRoot(): Path = Path.of(props.outputDir).toAbsolutePath().normalize()

    private fun safeFileName(title: String): String =
        title.replace(Regex("[\\\\/:*?\"<>|\\r\\n\\t]"), "_").trim().take(120).ifBlank { "paper" }

    private fun PaperExportArtifact.toDto() = ExportArtifactDto(
        id = id,
        paperId = paperId,
        versionId = versionId,
        format = format,
        engine = engine,
        byteSize = byteSize,
        contentVersion = contentVersion,
        status = status,
        downloadUrl = "/api/papers/$paperId/export/artifacts/$id/download",
        createdAt = createdAt,
    )
}
