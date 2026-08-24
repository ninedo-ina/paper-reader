package org.paperreader.service

import org.paperreader.dto.PaperContextChunkDto
import org.paperreader.dto.PaperContextDto
import org.paperreader.dto.PaperContextRequest
import org.paperreader.exception.ResourceNotFoundException
import org.paperreader.model.PaperChunk
import org.paperreader.repository.PaperChunkRepository
import org.paperreader.repository.PaperRepository
import org.springframework.stereotype.Service
import java.text.Normalizer

@Service
class PaperContextService(
    private val paperRepository: PaperRepository,
    private val paperChunkRepository: PaperChunkRepository,
) {
    fun getContext(paperId: Long, userId: Long, request: PaperContextRequest): PaperContextDto {
        require(request.selectedText.isNotBlank()) { "Selected text is required" }
        require(request.selectedText.length <= MAX_SELECTED_TEXT_LENGTH) { "Selected text is too long" }

        val paper = paperRepository.findByIdAndUserId(paperId, userId)
            ?: throw ResourceNotFoundException("Paper", paperId)
        val chunks = if (paper.parseStatus == "READY") {
            selectRelevantChunks(
                paperChunkRepository.findByPaperIdOrderByOrdinalAsc(paper.id),
                request.selectedText,
                request.pageNumber,
            )
        } else {
            emptyList()
        }

        return PaperContextDto(
            paperId = paper.id,
            title = paper.title,
            authors = paper.authors,
            abstractText = paper.abstractText,
            parseStatus = paper.parseStatus,
            parseError = paper.parseError,
            selectedText = request.selectedText.trim(),
            pageNumber = request.pageNumber,
            chunks = chunks.map { it.toDto() },
        )
    }

    private fun selectRelevantChunks(
        chunks: List<PaperChunk>,
        selectedText: String,
        pageNumber: Int?,
    ): List<PaperChunk> {
        if (chunks.isEmpty()) return emptyList()

        val normalizedSelection = normalize(selectedText)
        val terms = normalizedSelection
            .split(Regex("[^\\p{L}\\p{N}]+"))
            .filter { it.length >= 3 }
            .distinct()
            .take(32)

        val ranked = chunks.map { chunk ->
            val normalizedContent = normalize(chunk.content)
            val exact = if (normalizedContent.contains(normalizedSelection)) 1000 else 0
            val termScore = terms.count { normalizedContent.contains(it) } * 10
            val pageScore = if (pageNumber != null && chunk.pageStart == pageNumber) 25 else 0
            chunk to exact + termScore + pageScore
        }
            .filter { (_, score) -> score > 0 }
            .sortedWith(compareByDescending<Pair<PaperChunk, Int>> { it.second }.thenBy { it.first.ordinal })

        if (ranked.isEmpty()) return emptyList()

        val selectedOrdinals = ranked.take(MAX_MATCHED_CHUNKS).flatMap { (chunk, _) ->
            listOf(chunk.ordinal - 1, chunk.ordinal, chunk.ordinal + 1)
        }.toSet()

        return chunks
            .filter { it.ordinal in selectedOrdinals }
            .sortedBy { it.ordinal }
            .take(MAX_RETURNED_CHUNKS)
    }

    private fun normalize(value: String): String = Normalizer.normalize(value, Normalizer.Form.NFKC)
        .lowercase()
        .replace(Regex("\\s+"), " ")
        .trim()

    private fun PaperChunk.toDto() = PaperContextChunkDto(
        id = id,
        sectionTitle = sectionTitle,
        ordinal = ordinal,
        content = content,
        pageStart = pageStart,
        pageEnd = pageEnd,
    )

    companion object {
        private const val MAX_SELECTED_TEXT_LENGTH = 10000
        private const val MAX_MATCHED_CHUNKS = 3
        private const val MAX_RETURNED_CHUNKS = 7
    }
}
