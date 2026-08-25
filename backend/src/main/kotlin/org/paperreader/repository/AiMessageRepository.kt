package org.paperreader.repository

import org.paperreader.model.AiMessage
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.transaction.annotation.Transactional

interface AiMessageRepository : JpaRepository<AiMessage, Long> {
    fun findByChatIdOrderByCreatedAtAsc(chatId: Long): List<AiMessage>

    @Modifying
    @Transactional
    @Query("delete from AiMessage message where message.chatId in :chatIds")
    fun deleteByChatIdIn(chatIds: Collection<Long>): Int
}
