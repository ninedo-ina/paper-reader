package org.paperreader.model

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "pr_users")
data class User(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(unique = true, nullable = false, length = 255)
    val email: String,

    @Column(nullable = false)
    val passwordHash: String,

    @Column(length = 100)
    val displayName: String? = null,

    @Column(length = 500)
    val avatarUrl: String? = null,

    @Column(nullable = false)
    val createdAt: Instant = Instant.now(),

    val updatedAt: Instant = Instant.now(),

    @Column(nullable = false)
    val isActive: Boolean = true,
)
