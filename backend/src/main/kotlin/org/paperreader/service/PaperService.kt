package org.paperreader.service

import com.fasterxml.jackson.databind.ObjectMapper
import org.paperreader.dto.*
import org.paperreader.exception.ResourceNotFoundException
import org.paperreader.model.Paper
import org.paperreader.model.PaperTag
import org.paperreader.repository.PaperRepository
import org.paperreader.repository.PaperTagRepository
import org.slf4j.LoggerFactory
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile
import java.io.StringReader
import java.time.Instant
import javax.xml.parsers.DocumentBuilderFactory

@Service
class PaperService(
    private val paperRepository: PaperRepository,
    private val paperTagRepository: PaperTagRepository,
    private val fileStorageService: FileStorageService,
    private val grobidClient: GrobidClient,
    private val objectMapper: ObjectMapper,
) {
    private val logger = LoggerFactory.getLogger(PaperService::class.java)

    @Transactional
    fun uploadPdf(file: MultipartFile, userId: Long, title: String?): PaperDetailDto {
        val fileSize = file.size
        val paperTitle = title ?: file.originalFilename?.removeSuffix(".pdf") ?: "Untitled"

        val paper = paperRepository.save(
            Paper(
                userId = userId,
                title = paperTitle,
                sourceType = "UPLOAD",
                filePath = "",
                fileSize = fileSize,
            )
        )

        val filePath = fileStorageService.store(file, userId, paper.id)
        val stored = paper.copy(filePath = filePath)
        paperRepository.save(stored)

        val grobidResult = parsePdf(file.bytes, filePath, stored)
        return paperRepository.save(grobidResult).toDetailDto()
    }

    @Transactional
    fun uploadFromUrl(request: UploadFromUrlRequest, userId: Long): PaperDetailDto {
        val paper = paperRepository.save(
            Paper(
                userId = userId,
                title = request.title ?: "Paper from URL",
                sourceType = "URL",
                sourceUrl = request.url,
                filePath = "",
                fileSize = 0,
            )
        )

        val (filePath, pdfBytes) = fileStorageService.storeFromUrl(request.url, userId, paper.id)
        val stored = paper.copy(filePath = filePath, fileSize = pdfBytes.size.toLong())
        paperRepository.save(stored)

        val grobidResult = parsePdf(pdfBytes, filePath, stored)
        return paperRepository.save(grobidResult).toDetailDto()
    }

    @Transactional
    fun createPaper(request: CreatePaperRequest, userId: Long): PaperDetailDto {
        require(request.title.isNotBlank()) { "Title is required" }
        val paper = paperRepository.save(
            Paper(
                userId = userId,
                title = request.title,
                authors = request.authors,
                participants = request.participants,
                abstractText = request.abstractText,
                category = request.category ?: "JOURNAL",
                extraFields = request.extraFields?.let { objectMapper.writeValueAsString(it) },
                storageConfigId = request.storageConfigId,
                sourceType = "MANUAL",
                sourceUrl = null,
                filePath = null,
                pageCount = 0,
                fileSize = 0,
            )
        )
        return paper.toDetailDto()
    }

    fun getPaper(id: Long, userId: Long): PaperDetailDto {
        val paper = paperRepository.findByIdAndUserId(id, userId)
            ?: throw ResourceNotFoundException("Paper", id)
        return paper.toDetailDto()
    }

    fun listPapers(userId: Long, page: Int, pageSize: Int, sourceTypes: List<String>? = null): PageResponse<PaperListDto> {
        val pageRequest = PageRequest.of(page, pageSize)
        val result = if (sourceTypes.isNullOrEmpty()) {
            paperRepository.findByUserIdOrderByCreatedAtDesc(userId, pageRequest)
        } else {
            paperRepository.findByUserIdAndSourceTypeInOrderByCreatedAtDesc(userId, sourceTypes, pageRequest)
        }
        return PageResponse(
            items = result.content.map { it.toListDto() },
            total = result.totalElements,
            page = page,
            pageSize = pageSize,
        )
    }

    fun downloadPaper(id: Long, userId: Long): Pair<String, ByteArray> {
        val paper = paperRepository.findByIdAndUserId(id, userId)
            ?: throw ResourceNotFoundException("Paper", id)
        val filePath = paper.filePath
            ?: throw IllegalArgumentException("This paper has no downloadable file")
        val bytes = fileStorageService.read(filePath)
        return "${paper.title}.pdf" to bytes
    }

    @Transactional
    fun deletePaper(id: Long, userId: Long) {
        val paper = paperRepository.findByIdAndUserId(id, userId)
            ?: throw ResourceNotFoundException("Paper", id)
        paper.filePath?.let { fileStorageService.delete(it) }
        paperRepository.delete(paper)
    }

    @Transactional
    fun updatePaper(id: Long, userId: Long, request: UpdatePaperRequest): PaperDetailDto {
        val paper = paperRepository.findByIdAndUserId(id, userId)
            ?: throw ResourceNotFoundException("Paper", id)

        val updated = paper.copy(
            title = request.title ?: paper.title,
            authors = request.authors ?: paper.authors,
            participants = request.participants ?: paper.participants,
            abstractText = request.abstractText ?: paper.abstractText,
            category = request.category ?: paper.category,
            extraFields = request.extraFields?.let { objectMapper.writeValueAsString(it) } ?: paper.extraFields,
            doi = request.doi ?: paper.doi,
            year = request.year ?: paper.year,
            journal = request.journal ?: paper.journal,
            updatedAt = Instant.now(),
        )
        return paperRepository.save(updated).toDetailDto()
    }

    @Transactional
    fun toggleFavorite(id: Long, userId: Long, favorite: Boolean): PaperDetailDto {
        val paper = paperRepository.findByIdAndUserId(id, userId)
            ?: throw ResourceNotFoundException("Paper", id)
        val updated = paper.copy(favorite = favorite, updatedAt = Instant.now())
        return paperRepository.save(updated).toDetailDto()
    }

    fun listTags(paperId: Long, userId: Long): List<PaperTagDto> {
        val paper = paperRepository.findByIdAndUserId(paperId, userId)
            ?: throw ResourceNotFoundException("Paper", paperId)
        return paperTagRepository.findByPaperId(paper.id).map { it.toDto() }
    }

    @Transactional
    fun addTag(paperId: Long, userId: Long, tag: String): PaperTagDto {
        require(tag.isNotBlank()) { "Tag cannot be empty" }
        require(tag.length <= 100) { "Tag must be 100 characters or less" }
        val paper = paperRepository.findByIdAndUserId(paperId, userId)
            ?: throw ResourceNotFoundException("Paper", paperId)
        val existing = paperTagRepository.findByPaperIdAndTag(paper.id, tag)
        if (existing != null) return existing.toDto()
        return paperTagRepository.save(PaperTag(paperId = paper.id, tag = tag)).toDto()
    }

    @Transactional
    fun removeTag(paperId: Long, userId: Long, tag: String) {
        val paper = paperRepository.findByIdAndUserId(paperId, userId)
            ?: throw ResourceNotFoundException("Paper", paperId)
        paperTagRepository.deleteByPaperIdAndTag(paper.id, tag)
    }

    fun sharePaper(paperId: Long, userId: Long, description: String?): SharePaperResponse {
        val paper = paperRepository.findByIdAndUserId(paperId, userId)
            ?: throw ResourceNotFoundException("Paper", paperId)

        val url = paper.doi?.let { "https://doi.org/$it" } ?: paper.sourceUrl ?: ""
        val parts = mutableListOf<String>()
        if (!description.isNullOrBlank()) parts.add(description)
        parts.add(paper.title)
        if (url.isNotBlank()) parts.add(url)

        return SharePaperResponse(shareText = parts.joinToString(" — "))
    }

    private fun parsePdf(pdfBytes: ByteArray, filePath: String, paper: Paper): Paper {
        return try {
            logger.info("Sending to GROBID: paper {}", paper.id)
            val teiXml = grobidClient.processHeader(pdfBytes)
            val metadata = parseTeiMetadata(teiXml)
            paper.copy(
                title = metadata.title ?: paper.title,
                authors = metadata.authors,
                abstractText = metadata.abstractText,
                doi = metadata.doi,
                year = metadata.year,
                journal = metadata.journal,
                pageCount = metadata.pageCount ?: paper.pageCount,
                grobidResult = teiXml,
            )
        } catch (e: Exception) {
            logger.error("GROBID parsing failed for paper {}: {}", paper.id, e.message)
            paper
        }
    }

    private fun parseTeiMetadata(teiXml: String): TeiMetadata {
        try {
            val factory = DocumentBuilderFactory.newInstance()
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false)
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false)
            val doc = factory.newDocumentBuilder().parse(org.xml.sax.InputSource(teiXml.reader()))

            val title = doc.getElementsByTagName("title").let { nl ->
                if (nl.length > 0 && nl.item(0).textContent.isNotBlank()) nl.item(0).textContent.trim() else null
            }

            val authors = doc.getElementsByTagName("author").let { nl ->
                (0 until nl.length).mapNotNull { i ->
                    val el = nl.item(i)
                    val surname = el.childNodes.let { cn ->
                        (0 until cn.length).firstNotNullOfOrNull { j ->
                            if (cn.item(j).nodeName == "persName") {
                                val pn = cn.item(j)
                                val sn = pn.childNodes.let { pcn ->
                                    (0 until pcn.length).firstNotNullOfOrNull { k ->
                                        if (pcn.item(k).nodeName == "surname") pcn.item(k).textContent.trim() else null
                                    }
                                }
                                val fn = pn.childNodes.let { pcn ->
                                    (0 until pcn.length).firstNotNullOfOrNull { k ->
                                        if (pcn.item(k).nodeName == "forename") {
                                            val t = pcn.item(k).textContent.trim()
                                            if (t.length == 1) "$t." else t
                                        } else null
                                    }
                                }
                                if (sn != null && fn != null) "$fn $sn" else sn
                            } else null
                        }
                    } ?: el.textContent.trim().takeIf { it.isNotBlank() }
                }.joinToString(", ").takeIf { it.isNotBlank() }
            }

            val abstractText = doc.getElementsByTagName("abstract").let { nl ->
                if (nl.length > 0 && nl.item(0).textContent.isNotBlank()) nl.item(0).textContent.trim() else null
            }

            val doi = doc.getElementsByTagName("idno").let { nl ->
                (0 until nl.length).firstNotNullOfOrNull { i ->
                    val el = nl.item(i)
                    if (el.attributes?.getNamedItem("type")?.textContent == "DOI") el.textContent.trim() else null
                }
            }

            val year = doc.getElementsByTagName("date").let { nl ->
                if (nl.length > 0 && nl.item(0).textContent.isNotBlank()) nl.item(0).textContent.trim().take(4) else null
            }

            val journal = doc.getElementsByTagName("monogr").let { nl ->
                if (nl.length > 0) {
                    val monogr = nl.item(0) as org.w3c.dom.Element
                    val titleEl = monogr.getElementsByTagName("title").let { tnl ->
                        if (tnl.length > 0) tnl.item(0) else null
                    }
                    titleEl?.textContent?.trim()?.takeIf { it.isNotBlank() }
                } else null
            }

            val pageCount = doc.getElementsByTagName("biblScope").let { nl ->
                (0 until nl.length).firstNotNullOfOrNull { i ->
                    val el = nl.item(i)
                    if (el.attributes?.getNamedItem("unit")?.textContent == "page") {
                        el.textContent.trim().split("-").lastOrNull()?.toIntOrNull()
                    } else null
                }
            }

            return TeiMetadata(title, authors, abstractText, doi, year, journal, pageCount)
        } catch (e: Exception) {
            logger.warn("Failed to parse TEI XML: {}", e.message)
            return TeiMetadata(null, null, null, null, null, null, null)
        }
    }

    private data class TeiMetadata(
        val title: String?,
        val authors: String?,
        val abstractText: String?,
        val doi: String?,
        val year: String?,
        val journal: String?,
        val pageCount: Int?,
    )

    private fun Paper.toDetailDto() = PaperDetailDto(
        id = id,
        title = title,
        authors = authors,
        abstractText = abstractText,
        participants = participants,
        doi = doi,
        year = year,
        journal = journal,
        category = category,
        extraFields = extraFields?.let { objectMapper.readValue(it, Map::class.java) as Map<String, Any?> },
        storageConfigId = storageConfigId,
        favorite = favorite,
        sourceType = sourceType,
        sourceUrl = sourceUrl,
        pageCount = pageCount,
        fileSize = fileSize,
        grobidResult = null,
        createdAt = createdAt,
        updatedAt = updatedAt,
    )

    private fun Paper.toListDto() = PaperListDto(
        id = id,
        title = title,
        authors = authors,
        doi = doi,
        year = year,
        journal = journal,
        category = category,
        sourceType = sourceType,
        pageCount = pageCount,
        favorite = favorite,
        createdAt = createdAt,
    )

    private fun PaperTag.toDto() = PaperTagDto(
        id = id,
        paperId = paperId,
        tag = tag,
        createdAt = createdAt,
    )
}
