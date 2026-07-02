package org.paperreader.repository

import org.paperreader.model.AiChat
import org.springframework.data.jpa.repository.JpaRepository

interface AiChatRepository : JpaRepository<AiChat, Long> {
    fun findByUserIdOrderByCreatedAtDesc(userId: Long): List<AiChat>
    fun findByUserIdAndPaperId(userId: Long, paperId: Long?): List<AiChat>
}
