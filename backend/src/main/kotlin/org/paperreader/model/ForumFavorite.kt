package org.paperreader.model

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "pr_forum_favorites", uniqueConstraints = [UniqueConstraint(columnNames = ["user_id", "post_id"])])
data class ForumFavorite(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(name = "post_id", nullable = false)
    val postId: Long,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),
)
