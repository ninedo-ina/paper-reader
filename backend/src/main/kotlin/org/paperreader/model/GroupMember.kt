package org.paperreader.model

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "pr_group_members", uniqueConstraints = [UniqueConstraint(columnNames = ["group_id", "user_id"])])
data class GroupMember(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "group_id", nullable = false)
    val groupId: Long,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(nullable = false, length = 255)
    val username: String,

    @Column(name = "avatar_url", length = 1000)
    val avatarUrl: String? = null,

    @Column(name = "joined_at", nullable = false)
    val joinedAt: Instant = Instant.now(),
)
