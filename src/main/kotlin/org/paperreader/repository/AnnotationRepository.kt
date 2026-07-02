package org.paperreader.repository

import org.paperreader.model.Annotation
import org.springframework.data.jpa.repository.JpaRepository

interface AnnotationRepository : JpaRepository<Annotation, Long> {
    fun findByPaperIdAndUserId(paperId: Long, userId: Long): List<Annotation>
    fun deleteByPaperIdAndUserId(paperId: Long, userId: Long)
}
