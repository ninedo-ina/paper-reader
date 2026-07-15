package org.paperreader.model

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "pr_forum_disciplines")
data class ForumDiscipline(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false, length = 100)
    val name: String,

    @Column(name = "en_name", nullable = false, length = 100)
    val enName: String,

    @Column(name = "sort_order", nullable = false)
    val sortOrder: Int = 0,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),
)
