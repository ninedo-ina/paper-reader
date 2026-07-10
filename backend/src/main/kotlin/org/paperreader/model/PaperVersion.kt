package org.paperreader.model

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "pr_paper_versions")
data class PaperVersion(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false)
    val paperId: Long,

    @Column(nullable = false, length = 50)
    val version: String,

    @Column(columnDefinition = "TEXT")
    val remark: String? = null,

    @Column(nullable = false, length = 20)
    val storagePushStatus: String = "pending",

    @Column(nullable = false)
    val createdAt: Instant = Instant.now(),
)
