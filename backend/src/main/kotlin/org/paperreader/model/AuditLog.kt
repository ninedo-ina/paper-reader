package org.paperreader.model

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "pr_audit_logs")
data class AuditLog(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(nullable = false, length = 50)
    val event: String,

    @Column(nullable = false, length = 255)
    val operator: String,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),
)
