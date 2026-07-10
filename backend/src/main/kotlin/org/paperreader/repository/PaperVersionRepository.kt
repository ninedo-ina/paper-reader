package org.paperreader.repository

import org.paperreader.model.PaperVersion
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface PaperVersionRepository : JpaRepository<PaperVersion, Long> {
    fun findByPaperIdOrderByCreatedAtDesc(paperId: Long): List<PaperVersion>
}
