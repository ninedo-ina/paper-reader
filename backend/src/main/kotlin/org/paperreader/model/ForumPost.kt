package org.paperreader.model

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "pr_forum_posts")
data class ForumPost(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "topic_id", nullable = false)
    val topicId: Long,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(nullable = false, length = 500)
    val title: String,

    @Column(nullable = false, columnDefinition = "TEXT")
    val content: String,

    @Column(nullable = false, length = 255)
    val username: String,

    @Column(name = "avatar_url", length = 1000)
    val avatarUrl: String? = null,

    @Column(name = "like_count", nullable = false)
    val likeCount: Int = 0,

    @Column(name = "comment_count", nullable = false)
    val commentCount: Int = 0,

    @Column(name = "favorite_count", nullable = false)
    val favoriteCount: Int = 0,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),

    @Column(name = "updated_at", nullable = false)
    val updatedAt: Instant = Instant.now(),
)
