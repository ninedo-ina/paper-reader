package org.paperreader.model

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "pr_group_messages")
data class GroupMessage(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "group_id", nullable = false)
    val groupId: Long,

    @Column(name = "sender_id", nullable = false)
    val senderId: Long,

    @Column(nullable = false, length = 255)
    val username: String,

    @Column(name = "avatar_url", length = 1000)
    val avatarUrl: String? = null,

    @Column(nullable = false, columnDefinition = "TEXT")
    val content: String,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),
)
