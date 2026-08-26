package org.paperreader.repository

import jakarta.persistence.LockModeType
import org.paperreader.model.Paper
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface PaperRepository : JpaRepository<Paper, Long> {
    fun findByUserIdOrderByCreatedAtDesc(userId: Long): List<Paper>
    fun findByUserIdOrderByCreatedAtDesc(userId: Long, pageable: Pageable): Page<Paper>
    fun findByUserIdAndSourceTypeInOrderByCreatedAtDesc(userId: Long, sourceTypes: List<String>, pageable: Pageable): Page<Paper>
    fun findByUserIdAndFavoriteOrderByCreatedAtDesc(userId: Long, favorite: Boolean, pageable: Pageable): Page<Paper>
    fun findByUserIdAndFavoriteAndSourceTypeInOrderByCreatedAtDesc(userId: Long, favorite: Boolean, sourceTypes: List<String>, pageable: Pageable): Page<Paper>
    fun countByUserIdAndFavorite(userId: Long, favorite: Boolean): Long
    fun findByIdAndUserId(id: Long, userId: Long): Paper?

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Paper p WHERE p.id = :id AND p.userId = :userId")
    fun findForUpdateByIdAndUserId(@Param("id") id: Long, @Param("userId") userId: Long): Paper?

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Paper p WHERE p.id = :id")
    fun findForUpdateById(@Param("id") id: Long): Paper?
}
