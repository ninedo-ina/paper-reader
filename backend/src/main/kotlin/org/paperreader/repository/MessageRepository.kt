package org.paperreader.repository

import org.paperreader.model.Message
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface MessageRepository : JpaRepository<Message, Long> {
    @Query("SELECT m FROM Message m WHERE (m.senderId = :userId AND m.receiverId = :targetId) OR (m.senderId = :targetId AND m.receiverId = :userId) ORDER BY m.createdAt DESC")
    fun findConversation(userId: Long, targetId: Long, pageable: Pageable): Page<Message>

    @Query("SELECT DISTINCT CASE WHEN m.senderId = :userId THEN m.receiverId ELSE m.senderId END FROM Message m WHERE m.senderId = :userId OR m.receiverId = :userId")
    fun findDistinctContactIds(userId: Long): List<Long>

    @Query("SELECT m FROM Message m WHERE (m.senderId = :userId OR m.receiverId = :userId) ORDER BY m.createdAt DESC")
    fun findRecentMessages(userId: Long, pageable: Pageable): List<Message>
}
