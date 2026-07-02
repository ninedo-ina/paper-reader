package org.paperreader.repository

import org.paperreader.model.Paper
import org.springframework.data.jpa.repository.JpaRepository

interface PaperRepository : JpaRepository<Paper, Long> {
    fun findByUserIdOrderByCreatedAtDesc(userId: Long): List<Paper>
}
