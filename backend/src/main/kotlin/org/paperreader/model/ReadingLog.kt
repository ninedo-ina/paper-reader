package org.paperreader.model

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "pr_reading_logs")
data class ReadingLog(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false)
    val userId: Long,

    @Column(nullable = false)
    val paperId: Long,

    @Column(nullable = false)
    val currentPage: Int = 1,

    @Column(nullable = false)
    val totalPages: Int = 0,

    @Column(nullable = false)
    val durationSeconds: Long = 0,

    @Column(nullable = false)
    val createdAt: Instant = Instant.now(),
)
