package org.paperreader.service

import org.paperreader.model.Paper
import org.paperreader.model.PaperChunk
import org.paperreader.repository.PaperChunkRepository
import org.paperreader.repository.PaperRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

/** Keeps each parse-state transition and result write in a real proxied transaction. */
@Service
class PaperParsingPersistenceService(
    private val paperRepository: PaperRepository,
    private val paperChunkRepository: PaperChunkRepository,
) {
    @Transactional
    fun markProcessing(paperId: Long): Paper? {
        val paper = paperRepository.findById(paperId).orElse(null) ?: return null
        return paperRepository.save(
            paper.copy(
                parseStatus = "PROCESSING",
                parseError = null,
                updatedAt = Instant.now(),
            )
        )
    }

    @Transactional
    fun saveSuccess(paperId: Long, teiXml: String, parsed: TeiDocument): Paper? {
        val paper = paperRepository.findById(paperId).orElse(null) ?: return null
        paperChunkRepository.deleteByPaperId(paper.id)
        paperChunkRepository.saveAll(
            parsed.chunks.mapIndexed { index, chunk ->
                PaperChunk(
                    paperId = paper.id,
                    sectionTitle = chunk.sectionTitle,
                    ordinal = index,
                    content = chunk.content,
                    pageStart = chunk.pageStart,
                    pageEnd = chunk.pageEnd,
                )
            }
        )

        return paperRepository.save(
            paper.copy(
                title = parsed.metadata.title ?: paper.title,
                authors = parsed.metadata.authors ?: paper.authors,
                abstractText = parsed.metadata.abstractText ?: paper.abstractText,
                doi = parsed.metadata.doi ?: paper.doi,
                year = parsed.metadata.year ?: paper.year,
                journal = parsed.metadata.journal ?: paper.journal,
                pageCount = parsed.metadata.pageCount ?: paper.pageCount,
                grobidResult = teiXml,
                parseStatus = "READY",
                parseError = null,
                updatedAt = Instant.now(),
            )
        )
    }

    @Transactional
    fun markFailed(paperId: Long, error: String): Paper? {
        val paper = paperRepository.findById(paperId).orElse(null) ?: return null
        return paperRepository.save(
            paper.copy(
                parseStatus = "FAILED",
                parseError = error.take(1000),
                updatedAt = Instant.now(),
            )
        )
    }
}
