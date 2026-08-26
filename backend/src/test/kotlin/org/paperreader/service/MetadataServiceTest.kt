package org.paperreader.service

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import io.mockk.every
import io.mockk.impl.annotations.MockK
import io.mockk.junit5.MockKExtension
import io.mockk.mockk
import io.mockk.verify
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.paperreader.dto.MetadataApplyRequest
import org.paperreader.dto.MetadataResolveRequest
import org.paperreader.exception.BusinessException
import org.paperreader.model.Paper
import org.paperreader.model.PaperMetadataFieldProvenance
import org.paperreader.model.PaperMetadataResolution
import org.paperreader.model.PaperMetadataSource
import org.paperreader.repository.PaperMetadataFieldProvenanceRepository
import org.paperreader.repository.PaperMetadataResolutionRepository
import org.paperreader.repository.PaperMetadataSourceRepository
import org.paperreader.repository.PaperRepository
import org.springframework.http.HttpStatus
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.RestTemplate
import java.net.URI
import java.time.Instant

@ExtendWith(MockKExtension::class)
class MetadataServiceTest {
    @MockK(relaxed = true)
    private lateinit var paperRepository: PaperRepository

    @MockK(relaxed = true)
    private lateinit var resolutionRepository: PaperMetadataResolutionRepository

    @MockK(relaxed = true)
    private lateinit var sourceRepository: PaperMetadataSourceRepository

    @MockK(relaxed = true)
    private lateinit var provenanceRepository: PaperMetadataFieldProvenanceRepository

    @MockK
    private lateinit var restTemplate: RestTemplate

    @MockK(relaxed = true)
    private lateinit var paperService: PaperService

    private val objectMapper = jacksonObjectMapper().findAndRegisterModules()
    private val storedSources = mutableListOf<PaperMetadataSource>()
    private val storedProvenance = mutableListOf<PaperMetadataFieldProvenance>()
    private var storedResolution: PaperMetadataResolution? = null
    private var storedPaper: Paper? = null

    private val service by lazy {
        MetadataService(
            paperRepository,
            resolutionRepository,
            sourceRepository,
            provenanceRepository,
            objectMapper,
            restTemplate,
            paperService,
        )
    }

    @BeforeEach
    fun setUpRepositories() {
        storedSources.clear()
        storedProvenance.clear()
        storedResolution = null
        storedPaper = null

        every { resolutionRepository.save(any()) } answers {
            val value = arg<PaperMetadataResolution>(0).let { if (it.id == 0L) it.copy(id = 91L) else it }
            storedResolution = value
            value
        }
        every { sourceRepository.save(any()) } answers {
            val value = arg<PaperMetadataSource>(0).copy(id = (storedSources.size + 1).toLong())
            storedSources += value
            value
        }
        every { sourceRepository.findByResolutionIdOrderByFetchedAtAsc(any()) } answers { storedSources.toList() }
        every { provenanceRepository.save(any()) } answers {
            val value = arg<PaperMetadataFieldProvenance>(0).copy(id = (storedProvenance.size + 1).toLong())
            storedProvenance += value
            value
        }
        every { paperRepository.save(any()) } answers {
            arg<Paper>(0).also { storedPaper = it }
        }
        every { paperService.getPaper(any(), any()) } returns mockk(relaxed = true)
    }

    @Test
    fun `resolves Attention fixtures without mixing arxiv version DOI or publication pages`() {
        val paper = attentionPaper()
        every { paperRepository.findByIdAndUserId(7, 42) } returns paper
        stubAttentionProviders()

        val result = service.resolve(7, 42, MetadataResolveRequest("https://arxiv.org/abs/1706.03762"))

        assertEquals("1706.03762", result.identifiers["arxiv"])
        assertNull(result.identifiers["doi"])
        assertCandidate(result, "extra.arxivVersion", "7", selected = true, source = "ARXIV")
        assertCandidate(result, "extra.arxivCategories", "cs.CL, cs.LG", selected = true, source = "ARXIV")
        assertCandidate(result, "extra.repositoryDoi", "10.48550/arxiv.1706.03762", selected = true, source = "DATACITE")
        assertCandidate(result, "year", "2017", selected = true, source = "ARXIV")
        assertCandidate(result, "extra.volume", "30", selected = false, source = "NEURIPS")
        assertCandidate(result, "extra.publicationPages", "5998-6008", selected = false, source = "NEURIPS")
        assertFalse(result.fields.any { it.field == "doi" && it.suggestedValue?.contains("10.48550") == true })
        assertFalse(result.fields.any { it.field == "extra.volume" && it.suggestedValue == "7" })
        assertTrue(result.warnings.contains("FORMAL_PUBLICATION_CANDIDATE"))
        assertTrue(result.warnings.contains("DBLP_PUBLICATION_CANDIDATE"))
        assertEquals(setOf("ARXIV", "DATACITE", "NEURIPS", "DBLP"), result.sources.map { it.provider }.toSet())
    }

    @Test
    fun `default apply fills missing exact fields but leaves formal candidates unchecked`() {
        val paper = attentionPaper()
        every { paperRepository.findByIdAndUserId(7, 42) } returns paper
        stubAttentionProviders()
        service.resolve(7, 42, MetadataResolveRequest("1706.03762"))
        val preview = requireNotNull(storedResolution)
        every { resolutionRepository.findForUpdateByIdAndPaperIdAndUserId(91, 7, 42) } returns preview
        every { paperRepository.findForUpdateByIdAndUserId(7, 42) } returns paper

        val result = service.apply(7, 42, 91, MetadataApplyRequest())
        val saved = requireNotNull(storedPaper)
        val extra = objectMapper.readTree(saved.extraFields)

        assertEquals("2017", saved.year)
        assertEquals("7", extra.path("arxivVersion").asText())
        assertEquals("10.48550/arxiv.1706.03762", extra.path("repositoryDoi").asText())
        assertTrue(extra.path("volume").isMissingNode)
        assertTrue(extra.path("publicationPages").isMissingNode)
        assertNull(saved.doi)
        assertTrue(result.appliedFields.contains("year"))
        assertFalse(result.appliedFields.contains("extra.volume"))
        assertTrue(storedProvenance.all { it.matchMethod == "EXACT_ID" })
    }

    @Test
    fun `explicitly applies formal publication fields without changing PDF page count`() {
        val paper = attentionPaper()
        every { paperRepository.findByIdAndUserId(7, 42) } returns paper
        stubAttentionProviders()
        service.resolve(7, 42, MetadataResolveRequest("1706.03762"))
        val preview = requireNotNull(storedResolution)
        every { resolutionRepository.findForUpdateByIdAndPaperIdAndUserId(91, 7, 42) } returns preview
        every { paperRepository.findForUpdateByIdAndUserId(7, 42) } returns paper

        service.apply(
            7,
            42,
            91,
            MetadataApplyRequest(listOf("journal", "extra.volume", "extra.publicationPages", "extra.publisher")),
        )

        val saved = requireNotNull(storedPaper)
        val extra = objectMapper.readTree(saved.extraFields)
        assertEquals(15, saved.pageCount)
        assertEquals("Advances in Neural Information Processing Systems", saved.journal)
        assertEquals("30", extra.path("volume").asText())
        assertEquals("5998-6008", extra.path("publicationPages").asText())
        assertTrue(storedProvenance.all { it.matchMethod == "EXPLICIT_RELATION" })
    }

    @Test
    fun `rejects forged fields and a paper changed after preview`() {
        val paper = attentionPaper()
        every { paperRepository.findByIdAndUserId(7, 42) } returns paper
        stubAttentionProviders()
        service.resolve(7, 42, MetadataResolveRequest("1706.03762"))
        val preview = requireNotNull(storedResolution)
        every { resolutionRepository.findForUpdateByIdAndPaperIdAndUserId(91, 7, 42) } returns preview
        every { paperRepository.findForUpdateByIdAndUserId(7, 42) } returns paper

        assertThrows<BusinessException> {
            service.apply(7, 42, 91, MetadataApplyRequest(listOf("extra.forged")))
        }

        every { paperRepository.findForUpdateByIdAndUserId(7, 42) } returns paper.copy(updatedAt = paper.updatedAt.plusSeconds(1))
        val stale = assertThrows<BusinessException> {
            service.apply(7, 42, 91, MetadataApplyRequest())
        }
        assertEquals(HttpStatus.CONFLICT.value(), stale.httpStatus)

        every { paperRepository.findForUpdateByIdAndUserId(7, 42) } returns paper
        every { resolutionRepository.findForUpdateByIdAndPaperIdAndUserId(91, 7, 42) } returns
            preview.copy(expiresAt = Instant.now().minusSeconds(1))
        val expired = assertThrows<BusinessException> {
            service.apply(7, 42, 91, MetadataApplyRequest())
        }
        assertEquals(HttpStatus.CONFLICT.value(), expired.httpStatus)
        verify(exactly = 0) { provenanceRepository.save(match { it.fieldName == "extra.forged" }) }
    }

    @Test
    fun `uses only GROBID header identifiers and ignores bibliography DOI`() {
        val paper = attentionPaper().copy(
            sourceUrl = null,
            doi = null,
            grobidResult = """
                <TEI xmlns="http://www.tei-c.org/ns/1.0">
                  <teiHeader><fileDesc><sourceDesc><biblStruct><idno type="arXiv">arXiv:1706.03762v7</idno></biblStruct></sourceDesc></fileDesc></teiHeader>
                  <text><back><listBibl><biblStruct><idno type="DOI">10.9999/reference-only</idno></biblStruct></listBibl></back></text>
                </TEI>
            """.trimIndent(),
        )
        every { paperRepository.findByIdAndUserId(7, 42) } returns paper
        stubAttentionProviders()

        val result = service.resolve(7, 42, MetadataResolveRequest())

        assertEquals("1706.03762v7", result.identifiers["arxiv"])
        assertNull(result.identifiers["doi"])
        verify(exactly = 0) { restTemplate.getForObject(match<URI> { it.toString().contains("10.9999") }, String::class.java) }
    }

    @Test
    fun `falls back from an unavailable DataCite record to Crossref`() {
        val paper = Paper(
            id = 8,
            userId = 42,
            title = "An Example Paper",
            sourceType = "MANUAL",
            doi = "10.1234/example",
            updatedAt = Instant.parse("2026-08-26T00:00:00Z"),
        )
        every { paperRepository.findByIdAndUserId(8, 42) } returns paper
        every { restTemplate.getForObject(match<URI> { it.host == "api.datacite.org" }, String::class.java) } throws
            HttpClientErrorException(HttpStatus.NOT_FOUND)
        every { restTemplate.getForObject(match<URI> { it.host == "api.crossref.org" }, String::class.java) } returns
            fixture("crossref-example.json")

        val result = service.resolve(8, 42, MetadataResolveRequest())

        assertCandidate(result, "doi", "10.1234/example", selected = false, source = "CROSSREF")
        assertCandidate(result, "extra.volume", "12", selected = true, source = "CROSSREF")
        assertCandidate(result, "extra.publicationType", "JOURNAL_ARTICLE", selected = true, source = "CROSSREF")
        assertCandidate(result, "extra.issn", "1234-5678", selected = true, source = "CROSSREF")
        assertEquals(listOf("DATACITE", "CROSSREF"), result.sources.map { it.provider })
        assertEquals("FAILED", result.sources.first().status)
        assertEquals("NOT_FOUND", result.sources.first().errorCode)
    }

    private fun attentionPaper() = Paper(
        id = 7,
        userId = 42,
        title = "Attention Is All You Need",
        authors = "Ashish Vaswani, Noam Shazeer",
        sourceType = "UPLOAD",
        pageCount = 15,
        updatedAt = Instant.parse("2026-08-26T00:00:00Z"),
    )

    private fun stubAttentionProviders() {
        every { restTemplate.getForObject(match<URI> { it.host == "export.arxiv.org" }, String::class.java) } returns
            fixture("arxiv-attention.xml")
        every { restTemplate.getForObject(match<URI> { it.host == "api.datacite.org" }, String::class.java) } returns
            fixture("datacite-attention.json")
        every { restTemplate.getForObject(match<URI> { it.host == "dblp.org" }, String::class.java) } returns
            fixture("dblp-attention.json")
    }

    private fun fixture(name: String): String = requireNotNull(javaClass.getResource("/metadata/$name")).readText()

    private fun assertCandidate(
        result: org.paperreader.dto.MetadataResolutionDto,
        field: String,
        value: String,
        selected: Boolean,
        source: String,
    ) {
        val candidate = requireNotNull(result.fields.find { it.field == field }) { "Missing candidate $field" }
        assertEquals(value, candidate.suggestedValue)
        assertEquals(selected, candidate.selectedByDefault)
        assertEquals(source, candidate.source)
    }
}
