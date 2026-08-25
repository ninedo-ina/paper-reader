package org.paperreader.repository

import org.paperreader.model.PaperVersion
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.stereotype.Repository
import org.springframework.transaction.annotation.Transactional

@Repository
interface PaperVersionRepository : JpaRepository<PaperVersion, Long> {
    fun findByPaperIdOrderByCreatedAtDesc(paperId: Long): List<PaperVersion>

    @Modifying
    @Transactional
    @Query("delete from PaperVersion paperVersion where paperVersion.paperId = :paperId")
    fun deleteByPaperId(paperId: Long): Int
}
