package org.paperreader.model

import jakarta.persistence.*
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.Instant

@Entity
@Table(name = "pr_notes")
data class Note(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false)
    val userId: Long,

    @Column(nullable = false)
    val paperId: Long,

    @Column(length = 500)
    val title: String? = null,

    @Column(columnDefinition = "TEXT", nullable = false)
    val content: String,

    @Column(nullable = false)
    val pageNumber: Int = 0,

    val chapter: String? = null,

    @Column(length = 500)
    val tags: String? = null,

    @Column(name = "quoted_text", columnDefinition = "TEXT")
    val quotedText: String? = null,

    @Column(name = "start_offset")
    val startOffset: Int? = null,

    @Column(name = "end_offset")
    val endOffset: Int? = null,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    val position: String? = null,

    @Column(columnDefinition = "TEXT")
    val images: String? = null,

    @Column(nullable = false)
    val createdAt: Instant = Instant.now(),

    val updatedAt: Instant = Instant.now(),
)
