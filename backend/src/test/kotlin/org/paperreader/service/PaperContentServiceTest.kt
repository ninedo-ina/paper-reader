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
import org.paperreader.config.ContentProperties
import org.paperreader.dto.UpdatePaperContentRequest
import org.paperreader.dto.UpdatePaperRequest
import org.paperreader.exception.ContentTooLargeException
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

    @MockK
    private lateinit var uploadQuotaService: UploadQuotaService

    private val objectMapper = ObjectMapper()

    /** 默认上限（与服务端 application.yml 一致），够普通用例随便写。 */
    private val contentProperties = ContentProperties()

    private val service by lazy { buildService(contentProperties) }

    /** 用极小上限的配置再搭一个实例，把闸门用例的数据量压到几十字节。 */
    private fun buildService(props: ContentProperties) = PaperService(
        paperRepository,
        paperTagRepository,
        fileStorageService,
        paperParsingService,
        objectMapper,
        auditLogService,
        uploadQuotaService,
        props,
    )

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

    // ---- W9：体积上限、写放大控制、审计日志 ----

    @Test
    fun `records an audit entry every time the body is actually saved`() {
        stubbedSave()
        every { paperRepository.findForUpdateByIdAndUserId(7, 42) } returns Paper(
            id = 7,
            userId = 42,
            title = "Draft",
            sourceType = "MANUAL",
        )

        service.updatePaperContent(7, 42, UpdatePaperContentRequest(contentJson = body))

        // 「保存正文」是审计日志必须覆盖的动作之一（W9 交付物）。
        verify { auditLogService.log(42, "保存正文", "Draft") }
    }

    @Test
    fun `a save with byte-identical content is a no-op and does not touch the row`() {
        val stored = objectMapper.writeValueAsString(body)
        every { paperRepository.findForUpdateByIdAndUserId(7, 42) } returns Paper(
            id = 7,
            userId = 42,
            title = "Draft",
            sourceType = "MANUAL",
            contentJson = stored,
            contentHtml = "<p></p>",
            contentVersion = 6,
        )

        val result = service.updatePaperContent(
            7,
            42,
            UpdatePaperContentRequest(contentJson = body, contentHtml = "<p></p>"),
        )

        // 内容没变：不写库、不自增版本号、不记审计。
        // 版本号尤其关键——它一自增，另一个正在编辑的会话就会凭空撞出 409。
        assertEquals(6, result.contentVersion)
        verify(exactly = 0) { paperRepository.save(any()) }
        verify(exactly = 0) { auditLogService.log(any(), any(), any()) }
    }

    @Test
    fun `a save that only changes the rendered html still writes`() {
        val saved = stubbedSave()
        every { paperRepository.findForUpdateByIdAndUserId(7, 42) } returns Paper(
            id = 7,
            userId = 42,
            title = "Draft",
            sourceType = "MANUAL",
            contentJson = objectMapper.writeValueAsString(body),
            contentHtml = "<p>旧渲染</p>",
            contentVersion = 6,
        )

        val result = service.updatePaperContent(
            7,
            42,
            UpdatePaperContentRequest(contentJson = body, contentHtml = "<p>新渲染</p>"),
        )

        // 去重必须比对正文**和**渲染结果：只比正文会把渲染结果的修正丢掉。
        assertEquals(7, result.contentVersion)
        assertEquals("<p>新渲染</p>", saved.single().contentHtml)
    }

    @Test
    fun `rejects a body over the per-paper size limit`() {
        val props = ContentProperties().apply { maxJsonBytes = 100; maxHtmlBytes = 400; maxReadableBytes = 1_000 }
        val tiny = buildService(props)
        every { paperRepository.findForUpdateByIdAndUserId(7, 42) } returns Paper(
            id = 7,
            userId = 42,
            title = "Draft",
            sourceType = "MANUAL",
        )
        val cjkDoc = objectMapper.readTree("""{"type":"doc","content":[{"type":"text","text":"${"中".repeat(30)}"}]}""")

        // 前置断言：按字符数算它在闸门内，按 UTF-8 字节算它超了。
        // 这正是闸门必须按字节判的原因——中文一字 3 字节，按 length 判会漏掉三分之二。
        val serialized = objectMapper.writeValueAsString(cjkDoc)
        assertTrue(serialized.length <= props.maxJsonBytes, "用例前提：字符数应在上限内")
        assertTrue(serialized.toByteArray(Charsets.UTF_8).size > props.maxJsonBytes, "用例前提：字节数应超限")

        val ex = assertThrows<ContentTooLargeException> {
            tiny.updatePaperContent(7, 42, UpdatePaperContentRequest(contentJson = cjkDoc))
        }

        assertEquals(1014, ex.code)
        assertEquals(413, ex.httpStatus)
        verify(exactly = 0) { paperRepository.save(any()) }
    }

    @Test
    fun `rejects a rendered html over its own limit even when the body fits`() {
        val props = ContentProperties().apply { maxJsonBytes = 10_000; maxHtmlBytes = 100; maxReadableBytes = 10_000 }
        val tiny = buildService(props)
        every { paperRepository.findForUpdateByIdAndUserId(7, 42) } returns Paper(
            id = 7,
            userId = 42,
            title = "Draft",
            sourceType = "MANUAL",
        )

        val ex = assertThrows<ContentTooLargeException> {
            tiny.updatePaperContent(
                7,
                42,
                UpdatePaperContentRequest(contentJson = body, contentHtml = "<p>${"字".repeat(100)}</p>"),
            )
        }

        assertEquals(1014, ex.code)
        verify(exactly = 0) { paperRepository.save(any()) }
    }

    @Test
    fun `still reads a legacy body that sits between the write gate and the read ceiling`() {
        val props = ContentProperties().apply { maxJsonBytes = 100; maxHtmlBytes = 100; maxReadableBytes = 4_000 }
        val tiny = buildService(props)
        val legacyBody = """{"type":"doc","content":[{"type":"text","text":"${"旧".repeat(50)}"}]}"""
        every { paperRepository.findByIdAndUserId(7, 42) } returns Paper(
            id = 7,
            userId = 42,
            title = "Legacy",
            sourceType = "MANUAL",
            contentJson = legacyBody,
            contentVersion = 2,
        )

        // 写闸门（100B）比读闸门（4000B）小：闸门上线前写进来的大正文必须还能打开，
        // 否则用户连"自己删减"的机会都没有，那才是真的丢数据。
        val result = tiny.getPaperContent(7, 42)

        assertEquals(2, result.contentVersion)
        assertEquals("旧".repeat(50), result.contentJson!!["content"][0]["text"].asText())
    }

    @Test
    fun `refuses to load a body beyond the read ceiling so one GET cannot blow up the heap`() {
        val props = ContentProperties().apply { maxJsonBytes = 100; maxHtmlBytes = 100; maxReadableBytes = 200 }
        val tiny = buildService(props)
        every { paperRepository.findByIdAndUserId(7, 42) } returns Paper(
            id = 7,
            userId = 42,
            title = "Huge",
            sourceType = "MANUAL",
            contentJson = """{"type":"doc","content":[{"type":"text","text":"${"大".repeat(200)}"}]}""",
            contentVersion = 2,
        )

        val ex = assertThrows<ContentTooLargeException> { tiny.getPaperContent(7, 42) }

        assertEquals(1014, ex.code)
    }

    @Test
    fun `publishes the size limits and snapshot retention policy`() {
        val props = ContentProperties().apply {
            maxJsonBytes = 111
            maxHtmlBytes = 222
            maxReadableBytes = 333
            maxSnapshotCount = 7
            maxSnapshotAgeDays = 30
        }

        val limits = buildService(props).contentLimits()

        // 快照保留策略（W6 落地时必须遵守）随同一个接口下发，避免前端写死、也避免 W6 各写各的。
        assertEquals(111, limits.maxJsonBytes)
        assertEquals(222, limits.maxHtmlBytes)
        assertEquals(333, limits.maxReadableBytes)
        assertEquals(7, limits.maxSnapshotCount)
        assertEquals(30, limits.maxSnapshotAgeDays)
    }
}
