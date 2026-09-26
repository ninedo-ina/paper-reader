package org.paperreader.service

import com.fasterxml.jackson.databind.ObjectMapper
import io.mockk.every
import io.mockk.impl.annotations.MockK
import io.mockk.junit5.MockKExtension
import io.mockk.just
import io.mockk.runs
import io.mockk.slot
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.paperreader.dto.UpdatePaperContentRequest
import org.paperreader.dto.UpdatePaperRequest
import org.paperreader.exception.ContentVersionConflictException
import org.paperreader.exception.InvalidParameterException
import org.paperreader.exception.ResourceNotFoundException
import org.paperreader.model.Paper
import org.paperreader.repository.PaperRepository
import org.paperreader.repository.PaperTagRepository

@ExtendWith(MockKExtension::class)
class PaperContentServiceTest {
    @MockK
    private lateinit var paperRepository: PaperRepository

    @MockK
    private lateinit var paperTagRepository: PaperTagRepository

    @MockK
    private lateinit var fileStorageService: FileStorageService

    @MockK
    private lateinit var paperParsingService: PaperParsingService

    @MockK
    private lateinit var auditLogService: AuditLogService

    private val objectMapper = ObjectMapper()

    private val service by lazy {
        PaperService(
            paperRepository,
            paperTagRepository,
            fileStorageService,
            paperParsingService,
            objectMapper,
            auditLogService,
        )
    }

    private val body = objectMapper.readTree("""{"type":"doc","content":[{"type":"paragraph"}]}""")

    private fun stubbedSave(): MutableList<Paper> {
        val saved = mutableListOf<Paper>()
        every { paperRepository.save(capture(saved)) } answers { saved.last() }
        every { auditLogService.log(any(), any(), any()) } just runs
        return saved
    }

    @Test
    fun `returns an empty content payload for a paper that was never written in`() {
        every { paperRepository.findByIdAndUserId(7, 42) } returns Paper(
            id = 7,
            userId = 42,
            title = "Draft",
            sourceType = "MANUAL",
        )

        val result = service.getPaperContent(7, 42)

        assertEquals(7, result.paperId)
        assertNull(result.contentJson)
        assertNull(result.contentHtml)
        assertEquals(0, result.contentVersion)
    }

    @Test
    fun `returns exactly what was stored and does not expose the abstract as content`() {
        every { paperRepository.findByIdAndUserId(7, 42) } returns Paper(
            id = 7,
            userId = 42,
            title = "Draft",
            abstractText = "This is the abstract, not the body.",
            sourceType = "MANUAL",
            contentJson = """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"真实正文"}]}]}""",
            contentHtml = "<p>真实正文</p>",
            contentVersion = 3,
        )

        val result = service.getPaperContent(7, 42)

        assertEquals("真实正文", result.contentJson!!["content"][0]["content"][0]["text"].asText())
        assertEquals("<p>真实正文</p>", result.contentHtml)
        assertEquals(3, result.contentVersion)
    }

    @Test
    fun `does not expose another users paper content`() {
        every { paperRepository.findByIdAndUserId(7, 42) } returns null

        assertThrows<ResourceNotFoundException> { service.getPaperContent(7, 42) }
    }

    @Test
    fun `saves the editor JSON as the authority and the rendered HTML as the derived copy`() {
        val saved = stubbedSave()
        every { paperRepository.findForUpdateByIdAndUserId(7, 42) } returns Paper(
            id = 7,
            userId = 42,
            title = "Draft",
            abstractText = "Abstract stays put.",
            sourceType = "MANUAL",
        )

        val result = service.updatePaperContent(
            7,
            42,
            UpdatePaperContentRequest(contentJson = body, contentHtml = "<p></p>"),
        )

        val persisted = saved.single()
        assertEquals(objectMapper.writeValueAsString(body), persisted.contentJson)
        assertEquals("<p></p>", persisted.contentHtml)
        assertEquals("Abstract stays put.", persisted.abstractText)
        assertEquals(1, persisted.contentVersion)
        assertEquals(1, result.contentVersion)
        assertEquals("<p></p>", result.contentHtml)
    }

    @Test
    fun `bumps content version on every save so concurrent writers can be told apart`() {
        stubbedSave()
        every { paperRepository.findForUpdateByIdAndUserId(7, 42) } returns Paper(
            id = 7,
            userId = 42,
            title = "Draft",
            sourceType = "MANUAL",
            contentVersion = 4,
        )

        val result = service.updatePaperContent(7, 42, UpdatePaperContentRequest(contentJson = body))

        assertEquals(5, result.contentVersion)
    }

    @Test
    fun `rejects a stale save whose base version has fallen behind the current version`() {
        stubbedSave()
        every { paperRepository.findForUpdateByIdAndUserId(7, 42) } returns Paper(
            id = 7,
            userId = 42,
            title = "Draft",
            sourceType = "MANUAL",
            contentVersion = 5,
        )

        // 另一个会话已经把版本推到了 5，而这次保存还基于 3 —— 必须被拒，不能静默覆盖。
        val ex = assertThrows<ContentVersionConflictException> {
            service.updatePaperContent(7, 42, UpdatePaperContentRequest(contentJson = body, baseVersion = 3))
        }
        assertEquals(5, ex.currentVersion)
    }

    @Test
    fun `accepts a save whose base version matches the current version`() {
        stubbedSave()
        every { paperRepository.findForUpdateByIdAndUserId(7, 42) } returns Paper(
            id = 7,
            userId = 42,
            title = "Draft",
            sourceType = "MANUAL",
            contentVersion = 5,
        )

        val result = service.updatePaperContent(7, 42, UpdatePaperContentRequest(contentJson = body, baseVersion = 5))

        assertEquals(6, result.contentVersion)
    }

    @Test
    fun `skips the conflict check when no base version is supplied`() {
        stubbedSave()
        every { paperRepository.findForUpdateByIdAndUserId(7, 42) } returns Paper(
            id = 7,
            userId = 42,
            title = "Draft",
            sourceType = "MANUAL",
            contentVersion = 5,
        )

        val result = service.updatePaperContent(7, 42, UpdatePaperContentRequest(contentJson = body))

        assertEquals(6, result.contentVersion)
    }

    @Test
    fun `rejects a body that is not an editor document`() {
        assertThrows<InvalidParameterException> {
            service.updatePaperContent(7, 42, UpdatePaperContentRequest(contentHtml = "<p>orphan</p>"))
        }
        assertThrows<InvalidParameterException> {
            service.updatePaperContent(7, 42, UpdatePaperContentRequest(contentJson = objectMapper.readTree("""["not","a","doc"]""")))
        }
    }

    @Test
    fun `does not write content for another users paper`() {
        every { paperRepository.findForUpdateByIdAndUserId(7, 42) } returns null

        assertThrows<ResourceNotFoundException> {
            service.updatePaperContent(7, 42, UpdatePaperContentRequest(contentJson = body))
        }
    }

    // 元数据 PATCH 必须与正文完全无关：它既不能写正文，也不能把已有正文清掉。
    @Test
    fun `metadata update leaves the stored body untouched`() {
        val saved = stubbedSave()
        every { paperRepository.findForUpdateByIdAndUserId(7, 42) } returns Paper(
            id = 7,
            userId = 42,
            title = "Old title",
            abstractText = "Old abstract",
            sourceType = "MANUAL",
            contentJson = """{"type":"doc","content":[{"type":"paragraph"}]}""",
            contentHtml = "<p></p>",
            contentVersion = 2,
        )
        every { paperTagRepository.findByPaperId(7) } returns emptyList()

        service.updatePaper(7, 42, UpdatePaperRequest(title = "New title", abstractText = "New abstract"))

        val persisted = saved.single()
        assertEquals("New title", persisted.title)
        assertEquals("New abstract", persisted.abstractText)
        assertEquals("""{"type":"doc","content":[{"type":"paragraph"}]}""", persisted.contentJson)
        assertEquals("<p></p>", persisted.contentHtml)
        assertEquals(2, persisted.contentVersion)
    }

}
