package org.paperreader.service

import io.mockk.every
import io.mockk.impl.annotations.MockK
import io.mockk.junit5.MockKExtension
import io.mockk.slot
import io.mockk.verify
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.paperreader.model.Paper
import org.paperreader.repository.PaperChunkRepository
import org.paperreader.repository.PaperRepository

@ExtendWith(MockKExtension::class)
class PaperParsingPersistenceServiceTest {
    @MockK(relaxed = true)
    private lateinit var paperRepository: PaperRepository

    @MockK(relaxed = true)
    private lateinit var paperChunkRepository: PaperChunkRepository

    private val service by lazy { PaperParsingPersistenceService(paperRepository, paperChunkRepository) }

    @Test
    fun `GROBID completion fills blanks without overwriting confirmed metadata`() {
        val existing = Paper(
            id = 7,
            userId = 42,
            title = "Confirmed title",
            authors = "Confirmed author",
            abstractText = null,
            doi = "10.1000/confirmed",
            year = "2020",
            journal = "Confirmed venue",
            sourceType = "UPLOAD",
            pageCount = 9,
        )
        val parsed = TeiDocument(
            metadata = TeiMetadata(
                title = "Parsed title",
                authors = "Parsed author",
                abstractText = "Parsed abstract",
                doi = "10.1000/parsed",
                year = "2024",
                journal = "Parsed venue",
                pageCount = 15,
            ),
            chunks = emptyList(),
        )
        val saved = slot<Paper>()
        every { paperRepository.findForUpdateById(7) } returns existing
        every { paperRepository.save(capture(saved)) } answers { saved.captured }

        service.saveSuccess(7, "<TEI/>", parsed)

        assertEquals("Confirmed title", saved.captured.title)
        assertEquals("Confirmed author", saved.captured.authors)
        assertEquals("Parsed abstract", saved.captured.abstractText)
        assertEquals("10.1000/confirmed", saved.captured.doi)
        assertEquals("2020", saved.captured.year)
        assertEquals("Confirmed venue", saved.captured.journal)
        assertEquals(9, saved.captured.pageCount)
        assertEquals("READY", saved.captured.parseStatus)
        verify { paperRepository.findForUpdateById(7) }
    }

    @Test
    fun `missing paper leaves parse persistence untouched`() {
        every { paperRepository.findForUpdateById(9) } returns null

        assertNull(service.markProcessing(9))

        verify(exactly = 0) { paperRepository.save(any()) }
    }
}
