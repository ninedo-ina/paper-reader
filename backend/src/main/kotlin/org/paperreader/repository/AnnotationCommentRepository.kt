package org.paperreader.repository

import org.paperreader.model.AnnotationComment
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.transaction.annotation.Transactional

interface AnnotationCommentRepository : JpaRepository<AnnotationComment, Long> {
    fun findByAnnotationIdOrderByCreatedAtAsc(annotationId: Long): List<AnnotationComment>
    fun countByAnnotationId(annotationId: Long): Int

    @Modifying
    @Transactional
    @Query("delete from AnnotationComment annotationComment where annotationComment.annotationId = :annotationId")
    fun deleteByAnnotationId(annotationId: Long): Int
}
