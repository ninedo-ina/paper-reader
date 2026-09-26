package org.paperreader.service

import com.fasterxml.jackson.databind.ObjectMapper
import io.mockk.every
import io.mockk.impl.annotations.MockK
import io.mockk.junit5.MockKExtension
import io.mockk.just
import io.mockk.runs
import io.mockk.slot
import io.mockk.verify
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.paperreader.config.ExportProperties
import org.paperreader.dto.CreateExportRequest
import org.paperreader.dto.ImportMarkdownRequest
import org.paperreader.exception.InvalidParameterException
import org.paperreader.exception.ResourceNotFoundException
import org.paperreader.model.Paper
import org.paperreader.model.PaperExportArtifact
import org.paperreader.model.PaperVersion
import org.paperreader.repository.PaperExportArtifactRepository
import org.paperreader.repository.PaperRepository
import org.paperreader.repository.PaperVersionRepository
import java.nio.file.Files
import java.util.Optional

@ExtendWith(MockKExtension::class)
class PaperExportServiceTest {
    @MockK
    private lateinit var paperRepository: PaperRepository

    @MockK
    private lateinit var paperVersionRepository: PaperVersionRepository

    @MockK(relaxed = true)
    private lateinit var artifactRepository: PaperExportArtifactRepository

    @MockK
    private lateinit var engine: DocumentExportEngine

    @MockK(relaxed = true)
    private lateinit var auditLogService: AuditLogService

    private val objectMapper = ObjectMapper()
    private val props = ExportProperties().apply {
        outputDir = Files.createTempDirectory("pr-export-test-").toString()
    }

    private val service by lazy {
        PaperExportService(
            paperRepository,
            paperVersionRepository,
            artifactRepository,
            engine,
            objectMapper,
            auditLogService,
            props,
        )
    }

    private val paper = Paper(
        id = 1,
        userId = 42,
        title = "My Paper",
        sourceType = "MANUAL",
        contentHtml = "<p>hello</p>",
        contentVersion = 3,
    )

    @Test
    fun `export rejects a paper the user does not own`() {
        every { paperRepository.findByIdAndUserId(1, 42) } returns null
        assertThrows<ResourceNotFoundException> {
            service.export(1, 42, CreateExportRequest("markdown"))
        }
    }

    @Test
    fun `export rejects an unknown format`() {
        every { paperRepository.findByIdAndUserId(1, 42) } returns paper
        assertThrows<InvalidParameterException> {
            service.export(1, 42, CreateExportRequest("rtf"))
        }
    }

    @Test
    fun `export runs the engine, persists the artifact and records history`() {
        every { paperRepository.findByIdAndUserId(1, 42) } returns paper
        every { engine.export(ExportFormat.MARKDOWN, "<p>hello</p>", null, "My Paper") } returns "# hello".toByteArray()
        every { artifactRepository.findByPaperIdAndVersionIdIsNullAndFormat(1, "markdown") } returns emptyList()
        val saved = slot<PaperExportArtifact>()
        every { artifactRepository.save(capture(saved)) } answers { saved.captured.copy(id = 99) }
        every { auditLogService.log(any(), any(), any()) } just runs

        val dto = service.export(1, 42, CreateExportRequest("markdown"))

        assertEquals(99, dto.id)
        assertEquals("markdown", dto.format)
        assertEquals("pandoc", dto.engine)
        assertEquals(7L, dto.byteSize)
        assertEquals(3, dto.contentVersion) // 快照的是正文 content_version
        assertNull(dto.versionId)
        assertTrue(dto.downloadUrl.endsWith("/export/artifacts/99/download"))
        // 产物真实落盘（相对路径 paperId/uuid.ext）
        val onDisk = java.nio.file.Path.of(props.outputDir).resolve(saved.captured.filePath!!)
        assertTrue(Files.exists(onDisk))
        verify { auditLogService.log(42, "导出markdown", "My Paper") }
    }

    @Test
    fun `pdf export records the typst engine`() {
        every { paperRepository.findByIdAndUserId(1, 42) } returns paper
        every { engine.export(ExportFormat.PDF, "<p>hello</p>", null, "My Paper") } returns byteArrayOf(1, 2, 3)
        every { artifactRepository.findByPaperIdAndVersionIdIsNullAndFormat(1, "pdf") } returns emptyList()
        every { artifactRepository.save(any()) } answers { firstArg<PaperExportArtifact>().copy(id = 5) }
        every { auditLogService.log(any(), any(), any()) } just runs

        val dto = service.export(1, 42, CreateExportRequest("pdf"))
        assertEquals("pandoc+typst", dto.engine)
    }

    @Test
    fun `export hooks the artifact onto a published version`() {
        every { paperRepository.findByIdAndUserId(1, 42) } returns paper
        every { paperVersionRepository.findById(7) } returns Optional.of(
            PaperVersion(id = 7, paperId = 1, version = "投稿版"),
        )
        every { engine.export(ExportFormat.DOCX, "<p>hello</p>", null, "My Paper") } returns byteArrayOf(9)
        every { artifactRepository.findByPaperIdAndVersionIdAndFormat(1, 7, "docx") } returns emptyList()
        val saved = slot<PaperExportArtifact>()
        every { artifactRepository.save(capture(saved)) } answers { saved.captured.copy(id = 3) }
        every { auditLogService.log(any(), any(), any()) } just runs

        val dto = service.export(1, 42, CreateExportRequest("docx", versionId = 7))

        assertEquals(7, dto.versionId)
        assertEquals(7L, saved.captured.versionId)
    }

    @Test
    fun `export rejects a version that belongs to another paper`() {
        every { paperRepository.findByIdAndUserId(1, 42) } returns paper
        every { paperVersionRepository.findById(7) } returns Optional.of(
            PaperVersion(id = 7, paperId = 999, version = "x"),
        )
        assertThrows<InvalidParameterException> {
            service.export(1, 42, CreateExportRequest("markdown", versionId = 7))
        }
    }

    @Test
    fun `capabilities reflect what the engine reports`() {
        every { engine.isAvailable(any()) } returns true
        every { engine.isImportAvailable() } returns false

        val caps = service.getCapabilities()
        assertEquals(ExportFormat.entries.size, caps.formats.size)
        assertTrue(caps.formats.all { it.available })
        assertEquals(false, caps.importAvailable)
    }

    @Test
    fun `import delegates to the engine and returns html`() {
        every { paperRepository.findByIdAndUserId(1, 42) } returns paper
        every { engine.importMarkdown("# Title") } returns "<h1>Title</h1>"
        every { auditLogService.log(any(), any(), any()) } just runs

        val result = service.importMarkdown(1, 42, ImportMarkdownRequest("# Title"))
        assertEquals("<h1>Title</h1>", result.contentHtml)
    }

    @Test
    fun `import rejects blank markdown`() {
        every { paperRepository.findByIdAndUserId(1, 42) } returns paper
        assertThrows<InvalidParameterException> {
            service.importMarkdown(1, 42, ImportMarkdownRequest("   "))
        }
    }

    @Test
    fun `extractCslJson gathers bibliography entries from content json`() {
        val json = objectMapper.readTree(
            """
            {"type":"doc","content":[
              {"type":"paragraph","content":[{"type":"text","text":"hi"}]},
              {"type":"bibliography","attrs":{"entries":[
                {"id":"doi:10.1/x","type":"article-journal","title":"A"},
                {"id":"paper:2","type":"book","title":"B"}
              ]}}
            ]}
            """.trimIndent(),
        )
        val csl = service.extractCslJson(json)!!
        val arr = objectMapper.readTree(csl)
        assertEquals(2, arr.size())
        assertEquals("doi:10.1/x", arr[0]["id"].asText())
    }

    @Test
    fun `extractCslJson returns null when there is no bibliography`() {
        val json = objectMapper.readTree("""{"type":"doc","content":[{"type":"paragraph"}]}""")
        assertNull(service.extractCslJson(json))
    }
}
