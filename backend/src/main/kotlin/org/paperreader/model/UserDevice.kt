package org.paperreader.model

import jakarta.persistence.*
import java.time.Instant

/**
 * A browser/device that has signed in. Deleting the row revokes every access
 * token that carries the matching `did` claim, forcing a fresh sign-in.
 */
@Entity
@Table(name = "pr_user_devices")
data class UserDevice(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(name = "device_key", nullable = false, length = 64)
    val deviceKey: String,

    @Column(name = "device_name", nullable = false, length = 120)
    val deviceName: String,

    @Column(name = "user_agent", length = 500)
    val userAgent: String? = null,

    @Column(name = "ip_address", length = 64)
    val ipAddress: String? = null,

    @Column(nullable = false)
    val trusted: Boolean = false,

    @Column(name = "trusted_until")
    val trustedUntil: Instant? = null,

    @Column(name = "last_login_at", nullable = false)
    val lastLoginAt: Instant = Instant.now(),

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),
)
