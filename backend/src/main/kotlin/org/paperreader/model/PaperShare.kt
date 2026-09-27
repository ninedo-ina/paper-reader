package org.paperreader.model

import jakarta.persistence.*
import java.time.Instant

/**
 * 只读分享链接（W7，见 V19__collaboration.sql）。凭 [token] 免登录读取论文正文（只读），
 * 供没有账号的导师/合作者查看。role 预留 EDITOR 以便将来做"可编辑邀请链接"，本轮只签发 VIEWER。
 */
@Entity
@Table(name = "pr_paper_shares")
data class PaperShare(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "paper_id", nullable = false)
    val paperId: Long,

    @Column(nullable = false, length = 64)
    val token: String,

    @Column(nullable = false, length = 20)
    val role: String = "VIEWER",

    @Column(name = "created_by", nullable = false)
    val createdBy: Long,

    /** 空 = 永不过期。 */
    @Column(name = "expires_at")
    val expiresAt: Instant? = null,

    @Column(nullable = false)
    val revoked: Boolean = false,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),
)
