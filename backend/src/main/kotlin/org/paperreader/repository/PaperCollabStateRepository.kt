package org.paperreader.repository

import org.paperreader.model.PaperCollabState
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.transaction.annotation.Transactional

/** 主键即 paper_id（每篇论文一行）。get/upsert 走 JpaRepository 的 findById/save。 */
interface PaperCollabStateRepository : JpaRepository<PaperCollabState, Long> {
    @Modifying
    @Transactional
    @Query("delete from PaperCollabState s where s.paperId = :paperId")
    fun deleteByPaperId(paperId: Long): Int
}
