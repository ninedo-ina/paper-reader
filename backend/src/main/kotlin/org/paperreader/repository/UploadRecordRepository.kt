package org.paperreader.repository

import org.paperreader.model.UploadRecord
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.Instant

interface UploadRecordRepository : JpaRepository<UploadRecord, Long> {

    @Query("SELECT COALESCE(SUM(r.bytes), 0) FROM UploadRecord r WHERE r.userId = :userId")
    fun sumBytesByUserId(@Param("userId") userId: Long): Long

    @Query("SELECT COALESCE(SUM(r.bytes), 0) FROM UploadRecord r WHERE r.userId = :userId AND r.createdAt >= :since")
    fun sumBytesByUserIdSince(@Param("userId") userId: Long, @Param("since") since: Instant): Long

    @Query("SELECT COALESCE(SUM(r.bytes), 0) FROM UploadRecord r WHERE r.createdAt >= :since")
    fun sumBytesSince(@Param("since") since: Instant): Long
}
