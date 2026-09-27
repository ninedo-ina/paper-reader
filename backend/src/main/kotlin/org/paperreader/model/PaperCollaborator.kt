package org.paperreader.model

import jakarta.persistence.*
import java.time.Instant

/**
 * 结构化协作者（W7，见 V19__collaboration.sql）：某个真实注册用户对某篇论文的读写/只读授权。
 * 论文作者是隐式 EDITOR，不落这张表；这里只存作者额外授予权限的其他用户。
 * 与自由文本的 [Paper.participants]（署名）互补：participants 只是展示，权限判定看这里。
 */
@Entity
@Table(name = "pr_paper_collaborators")
data class PaperCollaborator(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "paper_id", nullable = false)
    val paperId: Long,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    /** EDITOR 可读写正文与协同编辑；VIEWER 只读。 */
    @Column(nullable = false, length = 20)
    val role: String,

    @Column(name = "created_by", nullable = false)
    val createdBy: Long,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),
)
