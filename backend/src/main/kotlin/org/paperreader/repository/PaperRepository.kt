package org.paperreader.repository

import org.paperreader.model.Paper
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository

interface PaperRepository : JpaRepository<Paper, Long> {
    fun findByUserIdOrderByCreatedAtDesc(userId: Long): List<Paper>
    fun findByUserIdOrderByCreatedAtDesc(userId: Long, pageable: Pageable): Page<Paper>
    fun findByUserIdAndSourceTypeInOrderByCreatedAtDesc(userId: Long, sourceTypes: List<String>, pageable: Pageable): Page<Paper>
    fun findByUserIdAndFavoriteOrderByCreatedAtDesc(userId: Long, favorite: Boolean, pageable: Pageable): Page<Paper>
    fun findByUserIdAndFavoriteAndSourceTypeInOrderByCreatedAtDesc(userId: Long, favorite: Boolean, sourceTypes: List<String>, pageable: Pageable): Page<Paper>
    fun countByUserIdAndFavorite(userId: Long, favorite: Boolean): Long
    fun findByIdAndUserId(id: Long, userId: Long): Paper?
}
