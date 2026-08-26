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
        val paper = paperRepository.findForUpdateById(paperId) ?: return null
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
        val paper = paperRepository.findForUpdateById(paperId) ?: return null
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
                // Parsing is an enrichment source. Never replace a value that
                // a user (or a previous confirmed source) already supplied.
                title = fillMissing(paper.title, parsed.metadata.title) ?: paper.title,
                authors = fillMissing(paper.authors, parsed.metadata.authors),
                abstractText = fillMissing(paper.abstractText, parsed.metadata.abstractText),
                doi = fillMissing(paper.doi, parsed.metadata.doi),
                year = fillMissing(paper.year, parsed.metadata.year),
                journal = fillMissing(paper.journal, parsed.metadata.journal),
                pageCount = if (paper.pageCount > 0) paper.pageCount else (parsed.metadata.pageCount ?: paper.pageCount),
                grobidResult = teiXml,
                parseStatus = "READY",
                parseError = null,
                updatedAt = Instant.now(),
            )
        )
    }

    private fun fillMissing(existing: String?, candidate: String?): String? =
        existing?.takeIf { it.isNotBlank() } ?: candidate?.takeIf { it.isNotBlank() }

    @Transactional
    fun markFailed(paperId: Long, error: String): Paper? {
        val paper = paperRepository.findForUpdateById(paperId) ?: return null
        return paperRepository.save(
            paper.copy(
                parseStatus = "FAILED",
                parseError = error.take(1000),
                updatedAt = Instant.now(),
            )
        )
    }
}
