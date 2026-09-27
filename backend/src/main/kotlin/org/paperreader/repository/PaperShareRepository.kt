package org.paperreader.repository

import org.paperreader.model.PaperShare
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.transaction.annotation.Transactional

interface PaperShareRepository : JpaRepository<PaperShare, Long> {
    fun findByToken(token: String): PaperShare?
    fun findByPaperIdOrderByCreatedAtDesc(paperId: Long): List<PaperShare>

    @Modifying
    @Transactional
    @Query("delete from PaperShare s where s.paperId = :paperId")
    fun deleteByPaperId(paperId: Long): Int
}
