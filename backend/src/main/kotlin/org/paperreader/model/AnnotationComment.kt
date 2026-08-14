package org.paperreader.model

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "pr_annotation_comments")
data class AnnotationComment(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "annotation_id", nullable = false)
    val annotationId: Long,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(columnDefinition = "TEXT", nullable = false)
    val content: String,

    @Column(name = "parent_id")
    val parentId: Long? = null,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),
)
