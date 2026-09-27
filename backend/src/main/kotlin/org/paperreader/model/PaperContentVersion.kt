package org.paperreader.model

import jakarta.persistence.*
import java.time.Instant

/**
 * 正文快照（W6）。与 [PaperVersion]（发布记录 / storage push 状态）是两张表、两种语义：
 * 本表只回答「这篇论文的正文在某时刻长什么样」，不参与对外发布。
 */
@Entity
@Table(name = "pr_paper_content_versions")
data class PaperContentVersion(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false)
    val paperId: Long,

    /** 手动标签（「初稿」「投稿版」）；null = 未打标签。 */
    @Column(length = 100)
    val label: String? = null,

    /** [SOURCE_MANUAL] 手动创建 / [SOURCE_ROLLBACK] 回滚前自动留下的当前态。 */
    @Column(nullable = false, length = 20)
    val source: String = SOURCE_MANUAL,

    /** 快照时刻的 pr_papers.content_version，便于和正文版本号对齐。 */
    @Column(nullable = false)
    val contentVersion: Int = 0,

    /** 权威正文（编辑器 JSON），与 pr_papers.content_json 同格式。 */
    @Column(nullable = false, columnDefinition = "TEXT")
    val contentJson: String,

    /** 派生 HTML，随快照一起留存，找回时无需重新渲染。 */
    @Column(columnDefinition = "TEXT")
    val contentHtml: String? = null,

    val createdBy: Long? = null,

    @Column(nullable = false)
    val createdAt: Instant = Instant.now(),
) {
    companion object {
        const val SOURCE_MANUAL = "MANUAL"
        const val SOURCE_ROLLBACK = "ROLLBACK"
    }
}
