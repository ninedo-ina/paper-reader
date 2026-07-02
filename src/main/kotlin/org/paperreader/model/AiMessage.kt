package org.paperreader.model

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "pr_ai_messages")
data class AiMessage(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false)
    val chatId: Long,

    @Column(nullable = false, length = 20)
    val role: String, // user, assistant, system

    @Column(columnDefinition = "TEXT", nullable = false)
    val content: String,

    @Column(nullable = false)
    val createdAt: Instant = Instant.now(),
)
