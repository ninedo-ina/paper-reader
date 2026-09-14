package org.paperreader.model

import jakarta.persistence.*
import java.time.Instant

/**
 * One of the nine single-use recovery codes handed out when two-factor
 * authentication is enabled. The plaintext never touches the database.
 */
@Entity
@Table(name = "pr_user_recovery_codes")
data class UserRecoveryCode(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(name = "code_hash", nullable = false, length = 100)
    val codeHash: String,

    @Column(name = "used_at")
    val usedAt: Instant? = null,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),
)
