package org.paperreader.model

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "pr_follows", uniqueConstraints = [UniqueConstraint(columnNames = ["follower_id", "followee_id"])])
data class Follow(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "follower_id", nullable = false)
    val followerId: Long,

    @Column(name = "followee_id", nullable = false)
    val followeeId: Long,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),
)
