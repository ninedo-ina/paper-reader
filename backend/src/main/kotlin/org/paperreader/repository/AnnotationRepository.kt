package org.paperreader.repository

import org.paperreader.model.Annotation
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.transaction.annotation.Transactional

interface AnnotationRepository : JpaRepository<Annotation, Long> {
    fun findByPaperIdAndUserId(paperId: Long, userId: Long): List<Annotation>
    fun findByPaperId(paperId: Long): List<Annotation>
    @Modifying
    @Transactional
    @Query("delete from Annotation annotation where annotation.paperId = :paperId")
    fun deleteByPaperId(paperId: Long): Int
    fun deleteByPaperIdAndUserId(paperId: Long, userId: Long)
    fun findByUserIdOrderByCreatedAtDesc(userId: Long, pageable: Pageable): Page<Annotation>
}
