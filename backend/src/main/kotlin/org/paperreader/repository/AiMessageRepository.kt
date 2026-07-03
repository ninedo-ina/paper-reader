package org.paperreader.repository

import org.paperreader.model.AiMessage
import org.springframework.data.jpa.repository.JpaRepository

interface AiMessageRepository : JpaRepository<AiMessage, Long> {
    fun findByChatIdOrderByCreatedAtAsc(chatId: Long): List<AiMessage>
}
