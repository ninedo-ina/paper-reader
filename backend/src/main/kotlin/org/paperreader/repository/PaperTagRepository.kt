package org.paperreader.repository

import org.paperreader.model.PaperTag
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.transaction.annotation.Transactional

interface PaperTagRepository : JpaRepository<PaperTag, Long> {
    fun findByPaperId(paperId: Long): List<PaperTag>
    fun findByPaperIdIn(paperIds: List<Long>): List<PaperTag>
    fun findByPaperIdAndTag(paperId: Long, tag: String): PaperTag?

    @Modifying
    @Transactional
    fun deleteByPaperIdAndTag(paperId: Long, tag: String)
}
