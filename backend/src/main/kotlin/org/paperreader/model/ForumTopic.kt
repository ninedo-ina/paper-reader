package org.paperreader.model

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "pr_forum_topics")
data class ForumTopic(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "discipline_id", nullable = false)
    val disciplineId: Long,

    @Column(nullable = false, length = 200)
    val name: String,

    @Column(name = "en_name", nullable = false, length = 200)
    val enName: String,

    @Column(name = "sort_order", nullable = false)
    val sortOrder: Int = 0,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),
)
