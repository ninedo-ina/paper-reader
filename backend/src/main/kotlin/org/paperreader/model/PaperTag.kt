package org.paperreader.model

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "pr_paper_tags")
data class PaperTag(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false)
    val paperId: Long,

    @Column(nullable = false, length = 100)
    val tag: String,

    @Column(nullable = false)
    val createdAt: Instant = Instant.now(),
)
