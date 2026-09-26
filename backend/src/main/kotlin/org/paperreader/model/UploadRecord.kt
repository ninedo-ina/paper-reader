package org.paperreader.model

import jakarta.persistence.*
import java.time.Instant

/**
 * 上传台账（只增不删）。见 V17__upload_quota.sql。
 * 配额按这里的累计量算，不按 pr_papers 的现存行算——否则删论文即可重置配额。
 * 因此 paperId 不建外键：论文被删掉时这行必须留下。
 */
@Entity
@Table(name = "pr_upload_records")
data class UploadRecord(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(name = "paper_id", nullable = false)
    val paperId: Long,

    @Column(nullable = false)
    val bytes: Long,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),
)
