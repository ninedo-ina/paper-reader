package org.paperreader.repository

import org.paperreader.model.ReadingLog
import org.springframework.data.jpa.repository.JpaRepository
import java.util.*

interface ReadingLogRepository : JpaRepository<ReadingLog, Long> {
    fun findByPaperIdAndUserIdOrderByCreatedAtDesc(paperId: Long, userId: Long): List<ReadingLog>
    fun findByUserIdOrderByCreatedAtDesc(userId: Long): List<ReadingLog>
    fun findTopByUserIdAndPaperIdOrderByCreatedAtDesc(userId: Long, paperId: Long): Optional<ReadingLog>
}
