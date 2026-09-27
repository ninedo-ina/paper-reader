package org.paperreader.model

import jakarta.persistence.*
import java.time.Instant

/**
 * 稿件批注/评论（W7，见 V20__collaboration.sql）。
 * 区别于 [AnnotationComment]（PDF 阅读标注下的回复）——这是编辑器正文里的批注。
 * [anchor] 是编辑器 comment 标记的 id；[quote] 是被批注的原文片段，锚点失效时仍可读。
 */
@Entity
@Table(name = "pr_paper_comments")
data class PaperComment(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "paper_id", nullable = false)
    val paperId: Long,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(length = 64)
    val anchor: String? = null,

    @Column(columnDefinition = "TEXT")
    val quote: String? = null,

    @Column(nullable = false, columnDefinition = "TEXT")
    val body: String,

    @Column(nullable = false)
    val resolved: Boolean = false,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),

    @Column(name = "updated_at", nullable = false)
    val updatedAt: Instant = Instant.now(),
)
