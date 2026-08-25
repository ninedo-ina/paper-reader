package org.paperreader.repository

import org.paperreader.model.ReadingLog
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.transaction.annotation.Transactional
import java.util.*

interface ReadingLogRepository : JpaRepository<ReadingLog, Long> {
    fun findByPaperIdAndUserIdOrderByCreatedAtDesc(paperId: Long, userId: Long): List<ReadingLog>
    @Modifying
    @Transactional
    @Query("delete from ReadingLog readingLog where readingLog.paperId = :paperId")
    fun deleteByPaperId(paperId: Long): Int
    fun findByUserIdOrderByCreatedAtDesc(userId: Long): List<ReadingLog>
    fun findTopByUserIdAndPaperIdOrderByCreatedAtDesc(userId: Long, paperId: Long): Optional<ReadingLog>
}
