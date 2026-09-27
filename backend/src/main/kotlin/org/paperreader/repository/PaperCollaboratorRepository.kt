package org.paperreader.repository

import org.paperreader.model.PaperCollaborator
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.transaction.annotation.Transactional

interface PaperCollaboratorRepository : JpaRepository<PaperCollaborator, Long> {
    fun findByPaperId(paperId: Long): List<PaperCollaborator>
    fun findByPaperIdAndUserId(paperId: Long, userId: Long): PaperCollaborator?
    fun findByUserId(userId: Long): List<PaperCollaborator>

    @Modifying
    @Transactional
    @Query("delete from PaperCollaborator c where c.paperId = :paperId")
    fun deleteByPaperId(paperId: Long): Int

    @Modifying
    @Transactional
    @Query("delete from PaperCollaborator c where c.paperId = :paperId and c.userId = :userId")
    fun deleteByPaperIdAndUserId(paperId: Long, userId: Long): Int
}
