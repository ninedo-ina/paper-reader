package org.paperreader.service

import org.paperreader.model.Paper
import org.paperreader.repository.PaperRepository
import org.slf4j.LoggerFactory
import org.springframework.context.ApplicationEventPublisher
import org.springframework.scheduling.annotation.Async
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

data class PaperParseRequestedEvent(
    val paperId: Long,
    val filePath: String,
)

@Service
class PaperParsingService(
    private val paperRepository: PaperRepository,
    private val grobidClient: GrobidClient,
    private val teiDocumentParser: TeiDocumentParser,
    private val fileStorageService: FileStorageService,
    private val parsingPersistenceService: PaperParsingPersistenceService,
    private val eventPublisher: ApplicationEventPublisher,
) {
    private val logger = LoggerFactory.getLogger(PaperParsingService::class.java)

    @Transactional
    fun requestParse(paper: Paper): Paper {
        val pending = paper.copy(
            parseStatus = "PENDING",
            parseError = null,
            updatedAt = Instant.now(),
        )
        val saved = paperRepository.save(pending)
        val filePath = saved.filePath
        if (!filePath.isNullOrBlank()) {
            eventPublisher.publishEvent(PaperParseRequestedEvent(saved.id, filePath))
        }
        return saved
    }

    @Async("paperParsingExecutor")
    @org.springframework.transaction.event.TransactionalEventListener(
        phase = org.springframework.transaction.event.TransactionPhase.AFTER_COMMIT,
    )
    fun parseAfterCommit(event: PaperParseRequestedEvent) {
        try {
            val paper = parsingPersistenceService.markProcessing(event.paperId) ?: return
            logger.info("Starting GROBID fulltext parsing for paper {}", paper.id)
            val pdfBytes = fileStorageService.read(event.filePath)
            val teiXml = grobidClient.processFulltext(pdfBytes)
            val parsed = teiDocumentParser.parse(teiXml)
            parsingPersistenceService.saveSuccess(event.paperId, teiXml, parsed)
            logger.info("GROBID fulltext parsing completed for paper {} with {} chunks", paper.id, parsed.chunks.size)
        } catch (error: Exception) {
            logger.warn(
                "GROBID fulltext parsing failed for paper {} (type={})",
                event.paperId,
                error.javaClass.simpleName,
            )
            parsingPersistenceService.markFailed(event.paperId, "全文解析失败，请稍后重试")
        }
    }
}
