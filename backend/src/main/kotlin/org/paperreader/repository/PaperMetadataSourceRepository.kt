package org.paperreader.repository

import org.paperreader.model.PaperMetadataSource
import org.springframework.data.jpa.repository.JpaRepository

interface PaperMetadataSourceRepository : JpaRepository<PaperMetadataSource, Long> {
    fun findByPaperIdAndUserIdOrderByFetchedAtDesc(paperId: Long, userId: Long): List<PaperMetadataSource>
    fun findByResolutionIdOrderByFetchedAtAsc(resolutionId: Long): List<PaperMetadataSource>
}
