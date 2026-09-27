package org.paperreader.repository

import org.paperreader.model.PaperComment
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.transaction.annotation.Transactional

interface PaperCommentRepository : JpaRepository<PaperComment, Long> {
    fun findByPaperIdOrderByCreatedAtAsc(paperId: Long): List<PaperComment>

    @Modifying
    @Transactional
    @Query("delete from PaperComment c where c.paperId = :paperId")
    fun deleteByPaperId(paperId: Long): Int
}
