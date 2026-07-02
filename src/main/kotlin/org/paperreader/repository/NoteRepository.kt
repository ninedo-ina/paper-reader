package org.paperreader.repository

import org.paperreader.model.Note
import org.springframework.data.jpa.repository.JpaRepository

interface NoteRepository : JpaRepository<Note, Long> {
    fun findByPaperIdAndUserId(paperId: Long, userId: Long): List<Note>
    fun findByUserIdOrderByCreatedAtDesc(userId: Long): List<Note>
}
