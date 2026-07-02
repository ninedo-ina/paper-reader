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

    @Column(name = "password_hash")
    val passwordHash: String? = null,

    @Column(name = "github_id", unique = true)
    val githubId: Long? = null,

    @Column(name = "auth_provider", nullable = false, length = 20)
    val authProvider: String = "local",

    @Column(name = "display_name", length = 100)
    val displayName: String? = null,

    @Column(name = "avatar_url", length = 500)
    val avatarUrl: String? = null,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),

    @Column(name = "updated_at")
    val updatedAt: Instant = Instant.now(),

    @Column(name = "is_active", nullable = false)
    val isActive: Boolean = true,
)
