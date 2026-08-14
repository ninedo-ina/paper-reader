package org.paperreader.repository

import org.paperreader.model.AnnotationComment
import org.springframework.data.jpa.repository.JpaRepository

interface AnnotationCommentRepository : JpaRepository<AnnotationComment, Long> {
    fun findByAnnotationIdOrderByCreatedAtAsc(annotationId: Long): List<AnnotationComment>
    fun countByAnnotationId(annotationId: Long): Int
    fun deleteByAnnotationId(annotationId: Long)
}
