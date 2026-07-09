package org.paperreader.service

import com.fasterxml.jackson.databind.ObjectMapper
import org.paperreader.dto.*
import org.paperreader.exception.ResourceNotFoundException
import org.paperreader.model.Paper
import org.paperreader.repository.PaperRepository
import org.slf4j.LoggerFactory
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile
import java.time.Instant

@Service
class PaperService(
    private val paperRepository: PaperRepository,
    private val fileStorageService: FileStorageService,
    private val grobidClient: GrobidClient,
    private val objectMapper: ObjectMapper,
) {
    private val logger = LoggerFactory.getLogger(PaperService::class.java)

    @Transactional
    fun uploadPdf(file: MultipartFile, userId: Long, title: String?): PaperDetailDto {
        val fileSize = file.size
        val paperTitle = title ?: file.originalFilename?.removeSuffix(".pdf") ?: "Untitled"

        // 1. Save paper record with placeholder filePath
        val paper = paperRepository.save(
            Paper(
                userId = userId,
                title = paperTitle,
                sourceType = "UPLOAD",
                filePath = "", // will be updated after storage
                fileSize = fileSize,
            )
        )

        // 2. Store file
        val filePath = fileStorageService.store(file, userId, paper.id)
        val stored = paper.copy(filePath = filePath)
        paperRepository.save(stored)

        // 3. Trigger GROBID parsing (async in production, sync for now)
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

    fun listPapers(userId: Long, page: Int, pageSize: Int): PageResponse<PaperListDto> {
        val pageRequest = PageRequest.of(page, pageSize)
        val result = paperRepository.findByUserIdOrderByCreatedAtDesc(userId, pageRequest)
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

    private fun parsePdf(pdfBytes: ByteArray, filePath: String, paper: Paper): Paper {
        return try {
            logger.info("Sending to GROBID: paper {}", paper.id)
            val teiXml = grobidClient.processHeader(pdfBytes)
            paper.copy(
                grobidResult = teiXml, // raw TEI XML, frontend can render/transform
            )
        } catch (e: Exception) {
            logger.error("GROBID parsing failed for paper {}: {}", paper.id, e.message)
            paper // return paper without GROBID result, user can retry
        }
    }

    private fun Paper.toDetailDto() = PaperDetailDto(
        id = id,
        title = title,
        authors = authors,
        abstractText = abstractText,
        participants = participants,
        doi = doi,
        year = year,
        journal = journal,
        sourceType = sourceType,
        sourceUrl = sourceUrl,
        pageCount = pageCount,
        fileSize = fileSize,
        grobidResult = null, // TEI XML is large; return on demand via separate endpoint
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
        sourceType = sourceType,
        pageCount = pageCount,
        createdAt = createdAt,
    )
}
