package org.paperreader.model

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "pr_annotations")
data class Annotation(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false)
    val userId: Long,

    @Column(nullable = false)
    val paperId: Long,

    @Column(nullable = false)
    val pageNumber: Int,

    @Column(nullable = false, length = 20)
    val type: String, // HIGHLIGHT, UNDERLINE, STRIKETHROUGH, NOTE, AREA

    @Column(length = 20)
    val color: String? = null,

    @Column(columnDefinition = "jsonb", nullable = false)
    val position: String, // {x, y, width, height}

    @Column(columnDefinition = "TEXT")
    val text: String? = null,

    @Column(columnDefinition = "TEXT")
    val comment: String? = null,

    @Column(nullable = false)
    val createdAt: Instant = Instant.now(),

    val updatedAt: Instant = Instant.now(),
)
