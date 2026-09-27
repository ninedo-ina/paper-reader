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
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.paperreader.config.ContentProperties
import org.paperreader.exception.ContentVersionConflictException
import org.paperreader.exception.InvalidParameterException
import org.paperreader.exception.ResourceNotFoundException
import org.paperreader.model.Paper
import org.paperreader.model.PaperContentVersion
import org.paperreader.repository.PaperContentVersionRepository
import org.paperreader.repository.PaperRepository
import java.time.Instant
import java.time.temporal.ChronoUnit

/**
 * W6（REQ-202609-0262）验收标准的钉子：
 * 1. 回滚到任意历史快照后，正文与那条快照一致；
 * 2. 回滚动作本身也产生一条新快照，且据此可以再回滚回来（回滚前的内容不会丢）。
 * 断言按「正文内容」比较，而不是只看状态码/行数——否则回滚写错内容也能过。
 */
@ExtendWith(MockKExtension::class)
class PaperContentVersionServiceTest {
    @MockK
    private lateinit var paperContentVersionRepository: PaperContentVersionRepository

    @MockK
    private lateinit var paperRepository: PaperRepository

    @MockK
    private lateinit var auditLogService: AuditLogService

    private val objectMapper = ObjectMapper()

    /** 保留策略（W9 交付物①）。可按用例调小上限，验淘汰；默认值即生产默认值。 */
    private val contentProperties = ContentProperties()

    private val service by lazy {
        PaperContentVersionService(
            paperContentVersionRepository,
            paperRepository,
            objectMapper,
            auditLogService,
            contentProperties,
        )
    }

    /** 内存版快照表：回滚是否真的可逆取决于之前的行还在不在，用 mock 返回固定值验不出来。 */
    private val snapshots = mutableListOf<PaperContentVersion>()

    /** 内存版主表：回滚改的是正文本身，下一轮 restore 必须读到改后的值。 */
    private var storedPaper: Paper? = null

    private val paperSlot = slot<Paper>()
    private val snapshotSlot = slot<PaperContentVersion>()

    private fun body(text: String) =
        """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"$text"}]}]}"""

    private fun wire(initial: Paper) {
        storedPaper = initial
        every { auditLogService.log(any(), any(), any()) } just runs

        every { paperRepository.findByIdAndUserId(any(), any()) } answers {
            storedPaper?.takeIf { it.id == firstArg<Long>() && it.userId == secondArg<Long>() }
        }
        every { paperRepository.findForUpdateByIdAndUserId(any(), any()) } answers {
            storedPaper?.takeIf { it.id == firstArg<Long>() && it.userId == secondArg<Long>() }
        }
        every { paperRepository.save(capture(paperSlot)) } answers {
            paperSlot.captured.also { storedPaper = it }
        }

        every { paperContentVersionRepository.save(capture(snapshotSlot)) } answers {
            val incoming = snapshotSlot.captured
            // 模拟 IDENTITY 主键：新行由库发号，这里按插入顺序发。用「当前最大 id + 1」而不是
            // 行数，否则淘汰删掉几行之后再插入会发出已用过的 id，和真实自增序列不符。
            val persisted = if (incoming.id == 0L) {
                incoming.copy(id = (snapshots.maxOfOrNull { it.id } ?: 0L) + 1)
            } else {
                incoming
            }
            snapshots.removeAll { it.id == persisted.id }
            snapshots += persisted
            persisted
        }
        every { paperContentVersionRepository.deleteAll(any<List<PaperContentVersion>>()) } answers {
            snapshots.removeAll(firstArg<List<PaperContentVersion>>().toSet())
        }
        every { paperContentVersionRepository.findByIdAndPaperId(any(), any()) } answers {
            val id = firstArg<Long>()
            val paperId = secondArg<Long>()
            snapshots.firstOrNull { it.id == id && it.paperId == paperId }
        }
        every { paperContentVersionRepository.findByPaperIdOrderByCreatedAtDescIdDesc(any()) } answers {
            val paperId = firstArg<Long>()
            snapshots.filter { it.paperId == paperId }
                .sortedWith(compareByDescending<PaperContentVersion> { it.createdAt }.thenByDescending { it.id })
        }
    }

    private fun draft(
        contentJson: String? = body("第一版"),
        contentHtml: String? = "<p>第一版</p>",
        contentVersion: Int? = 1,
    ) = Paper(
        id = 7,
        userId = 42,
        title = "Draft",
        sourceType = "MANUAL",
        contentJson = contentJson,
        contentHtml = contentHtml,
        contentVersion = contentVersion,
    )

    // ---- 快照创建 ----

    @Test
    fun `snapshots the current body together with its label and version`() {
        wire(draft(contentJson = body("初稿正文"), contentHtml = "<p>初稿正文</p>", contentVersion = 3))

        val result = service.createSnapshot(7, 42, "初稿")

        assertEquals("初稿", result.label)
        assertEquals(PaperContentVersion.SOURCE_MANUAL, result.source)
        assertEquals(3, result.contentVersion)
        val stored = snapshots.single()
        assertEquals(body("初稿正文"), stored.contentJson)
        assertEquals("<p>初稿正文</p>", stored.contentHtml)
        assertEquals(42, stored.createdBy)
    }

    @Test
    fun `treats a blank label as no label and trims a real one`() {
        wire(draft())

        assertNull(service.createSnapshot(7, 42, "   ").label)
        assertEquals("投稿版", service.createSnapshot(7, 42, "  投稿版  ").label)
    }

    @Test
    fun `rejects a label longer than the column allows instead of letting the database truncate it`() {
        wire(draft())

        assertThrows<InvalidParameterException> {
            service.createSnapshot(7, 42, "x".repeat(PaperContentVersionService.MAX_LABEL_LENGTH + 1))
        }
    }

    @Test
    fun `refuses to snapshot a paper that has never been written in`() {
        wire(draft(contentJson = null, contentHtml = null, contentVersion = null))

        assertThrows<InvalidParameterException> { service.createSnapshot(7, 42, "初稿") }
        assertEquals(emptyList<PaperContentVersion>(), snapshots)
    }

    @Test
    fun `does not snapshot another users paper`() {
        wire(draft())

        assertThrows<ResourceNotFoundException> { service.createSnapshot(7, 99, "初稿") }
        assertEquals(emptyList<PaperContentVersion>(), snapshots)
    }

    // ---- 时间线 ----

    @Test
    fun `lists the timeline with the newest snapshot first`() {
        wire(draft(contentJson = body("第三版")))
        val old = PaperContentVersion(
            id = 1, paperId = 7, label = "初稿", contentVersion = 1,
            contentJson = body("第一版"), createdAt = java.time.Instant.parse("2026-09-20T00:00:00Z"),
        )
        val recent = PaperContentVersion(
            id = 2, paperId = 7, label = "投稿版", contentVersion = 2,
            contentJson = body("第二版"), createdAt = java.time.Instant.parse("2026-09-25T00:00:00Z"),
        )
        snapshots += listOf(old, recent)

        val timeline = service.listSnapshots(7, 42)

        assertEquals(listOf(2L, 1L), timeline.map { it.id })
    }

    @Test
    fun `reads a single snapshot with its body for the compare view`() {
        wire(draft())
        val snapshot = PaperContentVersion(
            id = 5, paperId = 7, label = "初稿", contentVersion = 2,
            contentJson = body("历史正文"), contentHtml = "<p>历史正文</p>",
        )
        snapshots += snapshot

        val detail = service.getSnapshot(7, 42, 5)

        assertEquals("历史正文", detail.contentJson!!["content"][0]["content"][0]["text"].asText())
        assertEquals("<p>历史正文</p>", detail.contentHtml)
    }

    @Test
    fun `will not read a snapshot through a paper it does not belong to`() {
        wire(draft())
        snapshots += PaperContentVersion(id = 5, paperId = 8, contentJson = body("别人的论文"))

        assertThrows<ResourceNotFoundException> { service.getSnapshot(7, 42, 5) }
    }

    @Test
    fun `renames a snapshot without touching the stored body`() {
        wire(draft())
        snapshots += PaperContentVersion(id = 5, paperId = 7, contentJson = body("正文"))

        val renamed = service.renameSnapshot(7, 42, 5, "投稿版")

        assertEquals("投稿版", renamed.label)
        assertEquals(body("正文"), snapshots.single().contentJson)
    }

    // ---- 回滚（验收标准）----

    @Test
    fun `rolls the body back to exactly the snapshot that was picked`() {
        wire(draft(contentJson = body("当前正文"), contentHtml = "<p>当前正文</p>", contentVersion = 4))
        snapshots += PaperContentVersion(
            id = 5, paperId = 7, label = "初稿", contentVersion = 2,
            contentJson = body("历史正文"), contentHtml = "<p>历史正文</p>",
        )

        val restored = service.restoreSnapshot(7, 42, 5, baseVersion = 4)

        // 正文与那条快照一致 —— 逐字比对 JSON 与 HTML，而不是只看版本号自增。
        assertEquals(body("历史正文"), storedPaper!!.contentJson)
        assertEquals("<p>历史正文</p>", storedPaper!!.contentHtml)
        assertEquals("历史正文", restored.contentJson!!["content"][0]["content"][0]["text"].asText())
        assertEquals(5, restored.contentVersion)
    }

    @Test
    fun `records the pre-rollback body as a new snapshot so the rollback itself can be undone`() {
        wire(draft(contentJson = body("当前正文"), contentHtml = "<p>当前正文</p>", contentVersion = 4))
        snapshots += PaperContentVersion(
            id = 5, paperId = 7, label = "初稿", contentVersion = 2,
            contentJson = body("历史正文"), contentHtml = "<p>历史正文</p>",
        )

        service.restoreSnapshot(7, 42, 5, baseVersion = null)

        val autoSnapshot = snapshots.single { it.source == PaperContentVersion.SOURCE_ROLLBACK }
        assertEquals(7, autoSnapshot.paperId)
        assertEquals(body("当前正文"), autoSnapshot.contentJson)
        assertEquals("<p>当前正文</p>", autoSnapshot.contentHtml)
        assertEquals(4, autoSnapshot.contentVersion)
        assertNull(autoSnapshot.label)
    }

    @Test
    fun `rolling back and then rolling back to the auto snapshot returns the body to where it started`() {
        val original = body("当前正文")
        wire(draft(contentJson = original, contentHtml = "<p>当前正文</p>", contentVersion = 4))
        snapshots += PaperContentVersion(
            id = 5, paperId = 7, label = "初稿", contentVersion = 2,
            contentJson = body("历史正文"), contentHtml = "<p>历史正文</p>",
        )

        service.restoreSnapshot(7, 42, 5, baseVersion = null)
        assertEquals(body("历史正文"), storedPaper!!.contentJson)

        val autoSnapshot = snapshots.single { it.source == PaperContentVersion.SOURCE_ROLLBACK }
        service.restoreSnapshot(7, 42, autoSnapshot.id, baseVersion = null)

        assertEquals(original, storedPaper!!.contentJson)
        assertEquals("<p>当前正文</p>", storedPaper!!.contentHtml)
        assertEquals(6, storedPaper!!.contentVersion)
    }

    @Test
    fun `rejects a rollback whose base version has fallen behind the current version`() {
        wire(draft(contentJson = body("当前正文"), contentVersion = 4))
        snapshots += PaperContentVersion(id = 5, paperId = 7, contentJson = body("历史正文"))

        // 另一个会话已经写到第 4 版，这次回滚还基于第 2 版 —— 必须被拒，不能盖掉别人的新内容。
        val ex = assertThrows<ContentVersionConflictException> {
            service.restoreSnapshot(7, 42, 5, baseVersion = 2)
        }

        assertEquals(4, ex.currentVersion)
        assertEquals(body("当前正文"), storedPaper!!.contentJson)
        assertEquals(emptyList<PaperContentVersion>(), snapshots.filter { it.source == PaperContentVersion.SOURCE_ROLLBACK })
    }

    @Test
    fun `does not fabricate an empty snapshot when rolling back a paper that has no body yet`() {
        wire(draft(contentJson = null, contentHtml = null, contentVersion = null))
        snapshots += PaperContentVersion(id = 5, paperId = 7, contentJson = body("历史正文"))

        service.restoreSnapshot(7, 42, 5, baseVersion = null)

        assertEquals(body("历史正文"), storedPaper!!.contentJson)
        assertEquals(emptyList<PaperContentVersion>(), snapshots.filter { it.source == PaperContentVersion.SOURCE_ROLLBACK })
        assertEquals(1, storedPaper!!.contentVersion)
    }

    @Test
    fun `cannot roll a paper over to a snapshot that belongs to a different paper`() {
        wire(draft())
        snapshots += PaperContentVersion(id = 5, paperId = 8, contentJson = body("别人的正文"))

        assertThrows<ResourceNotFoundException> {
            service.restoreSnapshot(7, 42, 5, baseVersion = null)
        }
    }

    @Test
    fun `cannot roll back another users paper`() {
        wire(draft())
        snapshots += PaperContentVersion(id = 5, paperId = 7, contentJson = body("正文"))

        assertThrows<ResourceNotFoundException> {
            service.restoreSnapshot(7, 99, 5, baseVersion = null)
        }
    }

    // ---- 与「发布记录」的隔离 ----

    @Test
    fun `a manual snapshot is a pure read of the body and does not write the paper row`() {
        wire(draft(contentJson = body("正文")))

        service.createSnapshot(7, 42, "投稿版")

        // 快照只往 pr_paper_content_versions 里加一行（发布记录表根本不在本服务依赖里），
        // pr_papers 不动：否则打标签会顺带把 content_version 推高，让前端的并发判定误报冲突。
        val stored: PaperContentVersion = snapshots.single()
        assertNotNull(stored.contentJson)
        assertEquals("投稿版", stored.label)
        verify(exactly = 0) { paperRepository.save(any()) }
    }

    // ---- 保留策略（W9 交付物①：历史快照保留多少）----

    /** 预置一条历史快照。[ageDays] 用来构造「超龄」的行。 */
    private fun seedSnapshot(
        id: Long,
        label: String? = null,
        source: String = PaperContentVersion.SOURCE_MANUAL,
        ageDays: Long = 0,
    ) {
        snapshots += PaperContentVersion(
            id = id,
            paperId = 7,
            label = label,
            source = source,
            contentVersion = 1,
            contentJson = body("第 $id 版"),
            createdAt = Instant.now().minus(ageDays, ChronoUnit.DAYS),
        )
    }

    private fun storedIds() = snapshots.map { it.id }.sorted()

    @Test
    fun `keeps at most the configured number of snapshots and drops the oldest unlabeled first`() {
        wire(draft(contentJson = body("当前正文")))
        contentProperties.maxSnapshotCount = 3
        (1L..4L).forEach { seedSnapshot(it) }

        service.createSnapshot(7, 42, null)

        // 4 条历史 + 新写的 = 5 条，上限 3，超出的 2 条从最旧的开始淘汰。
        assertEquals(listOf(3L, 4L, 5L), storedIds())
    }

    @Test
    fun `never prunes the snapshot it just created`() {
        wire(draft(contentJson = body("当前正文")))
        contentProperties.maxSnapshotCount = 1
        seedSnapshot(1, label = "旧标签")
        seedSnapshot(2)

        val created = service.createSnapshot(7, 42, "最新")

        // 上限 1 时「保留最新」必须成立：否则用户刚点的「保存快照」当场就被自己的淘汰逻辑删掉。
        assertEquals(listOf(created.id), storedIds())
    }

    @Test
    fun `prunes labeled snapshots only when nothing unlabeled is left to drop`() {
        wire(draft(contentJson = body("当前正文")))
        contentProperties.maxSnapshotCount = 2
        seedSnapshot(1, label = "初稿")
        seedSnapshot(2, label = "投稿版")
        seedSnapshot(3)

        service.createSnapshot(7, 42, null)

        // 先删未打标签的 3，还不够才动最旧的标签快照 1；剩下的标签快照 2 保住。
        assertEquals(listOf(2L, 4L), storedIds())
    }

    @Test
    fun `drops unlabeled snapshots past the retention window but keeps a labeled one`() {
        wire(draft(contentJson = body("当前正文")))
        contentProperties.maxSnapshotAgeDays = 90
        contentProperties.maxSnapshotCount = 50 // 不让份数上限干扰这条断言
        seedSnapshot(1, ageDays = 120)
        seedSnapshot(2, label = "投稿版", ageDays = 120)
        seedSnapshot(3, ageDays = 10)

        service.createSnapshot(7, 42, null)

        // 标签是用户明说「这份要留着」，不因为时间久了被静默删除。
        assertEquals(listOf(2L, 3L, 4L), storedIds())
    }

    @Test
    fun `rollback keeps both the snapshot it restored to and the one it left behind`() {
        wire(draft(contentJson = body("当前正文"), contentHtml = "<p>当前正文</p>", contentVersion = 1))
        contentProperties.maxSnapshotCount = 2
        seedSnapshot(1, ageDays = 400) // 本次回滚的目标：即使超龄也必须留下
        seedSnapshot(2, ageDays = 400)

        service.restoreSnapshot(7, 42, 1, baseVersion = 1)

        assertEquals(listOf(1L, 3L), storedIds())
        assertEquals(body("第 1 版"), storedPaper!!.contentJson)
        // 留下的那条是回滚前的留档——淘汰不能把「回滚可逆」这条验收标准删掉。
        val rollback = snapshots.single { it.id == 3L }
        assertEquals(PaperContentVersion.SOURCE_ROLLBACK, rollback.source)
        assertEquals(body("当前正文"), rollback.contentJson)
    }
}
