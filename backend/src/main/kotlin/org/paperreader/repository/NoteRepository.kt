package org.paperreader.repository

import org.paperreader.model.Note
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.transaction.annotation.Transactional

interface NoteRepository : JpaRepository<Note, Long> {
    fun findByPaperIdAndUserId(paperId: Long, userId: Long): List<Note>
    @Modifying
    @Transactional
    @Query("delete from Note note where note.paperId = :paperId")
    fun deleteByPaperId(paperId: Long): Int
    fun findByUserIdOrderByCreatedAtDesc(userId: Long): List<Note>
    fun findByUserIdOrderByCreatedAtDesc(userId: Long, pageable: Pageable): Page<Note>
}
