package org.paperreader.repository

import org.paperreader.model.PaperChunk
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.transaction.annotation.Transactional

interface PaperChunkRepository : JpaRepository<PaperChunk, Long> {
    fun findByPaperIdOrderByOrdinalAsc(paperId: Long): List<PaperChunk>

    @Modifying
    @Transactional
    @Query("delete from PaperChunk chunk where chunk.paperId = :paperId")
    fun deleteByPaperId(paperId: Long)
}
