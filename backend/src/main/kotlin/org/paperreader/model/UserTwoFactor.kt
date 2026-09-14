package org.paperreader.model

import jakarta.persistence.*
import java.time.Instant

/**
 * The authenticator (TOTP) binding of a single user. A row exists as soon as
 * the user starts the scan-and-confirm wizard; [enabled] only flips to true
 * after the user proves possession of the secret with a valid code.
 */
@Entity
@Table(name = "pr_user_two_factor")
data class UserTwoFactor(
    @Id
    @Column(name = "user_id")
    val userId: Long,

    /** Base32 (RFC 4648, unpadded) shared secret. */
    @Column(nullable = false, length = 64)
    val secret: String,

    @Column(nullable = false)
    val enabled: Boolean = false,

    @Column(name = "confirmed_at")
    val confirmedAt: Instant? = null,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),

    @Column(name = "updated_at", nullable = false)
    val updatedAt: Instant = Instant.now(),
)
