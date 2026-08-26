package org.paperreader.repository

import org.paperreader.model.PaperMetadataResolution
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface PaperMetadataResolutionRepository : JpaRepository<PaperMetadataResolution, Long> {
    fun findByIdAndPaperIdAndUserId(id: Long, paperId: Long, userId: Long): PaperMetadataResolution?

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM PaperMetadataResolution r WHERE r.id = :id AND r.paperId = :paperId AND r.userId = :userId")
    fun findForUpdateByIdAndPaperIdAndUserId(
        @Param("id") id: Long,
        @Param("paperId") paperId: Long,
        @Param("userId") userId: Long,
    ): PaperMetadataResolution?
}
