package org.paperreader.repository

import org.paperreader.model.AiChat
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.transaction.annotation.Transactional

interface AiChatRepository : JpaRepository<AiChat, Long> {
    fun findByUserIdOrderByCreatedAtDesc(userId: Long): List<AiChat>
    fun findByUserIdAndPaperId(userId: Long, paperId: Long?): List<AiChat>
    fun findByPaperId(paperId: Long): List<AiChat>

    @Modifying
    @Transactional
    @Query("delete from AiChat chat where chat.paperId = :paperId")
    fun deleteByPaperId(paperId: Long): Int
}
