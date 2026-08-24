package org.paperreader.service

import io.mockk.every
import io.mockk.impl.annotations.MockK
import io.mockk.junit5.MockKExtension
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.paperreader.dto.PaperContextRequest
import org.paperreader.exception.ResourceNotFoundException
import org.paperreader.model.Paper
import org.paperreader.model.PaperChunk
import org.paperreader.repository.PaperChunkRepository
import org.paperreader.repository.PaperRepository
import java.util.Optional

@ExtendWith(MockKExtension::class)
class PaperContextServiceTest {
    @MockK
    private lateinit var paperRepository: PaperRepository

    @MockK
    private lateinit var paperChunkRepository: PaperChunkRepository

    private val service by lazy { PaperContextService(paperRepository, paperChunkRepository) }

    @Test
    fun `returns selected paper context and nearby relevant chunks`() {
        val paper = Paper(
            id = 7,
            userId = 42,
            title = "Attention Is All You Need",
            abstractText = "A paper abstract.",
            sourceType = "UPLOAD",
            filePath = "/papers/7.pdf",
            parseStatus = "READY",
        )
        val chunks = listOf(
            PaperChunk(id = 1, paperId = 7, ordinal = 0, sectionTitle = "Introduction", content = "Background text."),
            PaperChunk(id = 2, paperId = 7, ordinal = 1, sectionTitle = "Attention", content = "Self-attention relates positions in a sequence."),
            PaperChunk(id = 3, paperId = 7, ordinal = 2, sectionTitle = "Attention", content = "The attention output uses weighted values.", pageStart = 3),
        )
        every { paperRepository.findByIdAndUserId(7, 42) } returns paper
        every { paperChunkRepository.findByPaperIdOrderByOrdinalAsc(7) } returns chunks

        val result = service.getContext(
            7,
            42,
            PaperContextRequest("self-attention relates positions", pageNumber = 3),
        )

        assertEquals(7, result.paperId)
        assertEquals("READY", result.parseStatus)
        assertEquals("A paper abstract.", result.abstractText)
        assertTrue(result.chunks.any { it.id == 2L })
        assertTrue(result.chunks.any { it.id == 3L })
    }

    @Test
    fun `does not expose another users paper`() {
        every { paperRepository.findByIdAndUserId(7, 42) } returns null

        assertThrows<ResourceNotFoundException> {
            service.getContext(7, 42, PaperContextRequest("selected text"))
        }
    }

    @Test
    fun `does not query chunks before parsing is ready`() {
        val paper = Paper(
            id = 7,
            userId = 42,
            title = "Pending Paper",
            sourceType = "UPLOAD",
            filePath = "/papers/7.pdf",
            parseStatus = "PROCESSING",
        )
        every { paperRepository.findByIdAndUserId(7, 42) } returns paper

        val result = service.getContext(7, 42, PaperContextRequest("selected text"))

        assertEquals("PROCESSING", result.parseStatus)
        assertTrue(result.chunks.isEmpty())
        io.mockk.verify(exactly = 0) { paperChunkRepository.findByPaperIdOrderByOrdinalAsc(7) }
    }
}
