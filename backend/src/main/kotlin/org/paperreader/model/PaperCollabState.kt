package org.paperreader.model

import jakarta.persistence.*
import java.time.Instant

/**
 * Yjs 文档全量状态（W7，见 V20__collaboration.sql）。每篇论文一行，paper_id 即主键。
 * 服务端把 [state] 当不透明 base64 存储，不解析 CRDT——协同的冲突消解全在客户端 Yjs 完成。
 * 新加入的客户端先用这份状态还原文档，再接实时增量；据此保证"文档身份"跨会话稳定，避免重复内容。
 */
@Entity
@Table(name = "pr_paper_collab_state")
data class PaperCollabState(
    @Id
    @Column(name = "paper_id")
    val paperId: Long,

    /** base64(Y.encodeStateAsUpdate(doc))。 */
    @Column(nullable = false, columnDefinition = "TEXT")
    val state: String,

    @Column(name = "updated_at", nullable = false)
    val updatedAt: Instant = Instant.now(),
)
