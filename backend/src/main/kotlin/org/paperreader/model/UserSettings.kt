package org.paperreader.model

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "pr_user_settings")
data class UserSettings(
    @Id
    val userId: Long,

    @Column(nullable = false, length = 10)
    val theme: String = "light",

    @Column(nullable = false, length = 10)
    val language: String = "zh",

    @Column(length = 50)
    val defaultAiModel: String? = null,

    @Column(nullable = false)
    val updatedAt: Instant = Instant.now(),
)
