package org.paperreader.repository

import org.paperreader.model.PaperContentVersion
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.stereotype.Repository
import org.springframework.transaction.annotation.Transactional

@Repository
interface PaperContentVersionRepository : JpaRepository<PaperContentVersion, Long> {
    /** 时间线：新的在前。同一时刻落两条时用 id 兜底，保证顺序稳定。 */
    fun findByPaperIdOrderByCreatedAtDescIdDesc(paperId: Long): List<PaperContentVersion>

    /** 取单条时必须带上 paperId：否则可以用自己论文的 id 去读别人论文的快照。 */
    fun findByIdAndPaperId(id: Long, paperId: Long): PaperContentVersion?

    @Modifying
    @Transactional
    @Query("delete from PaperContentVersion version where version.paperId = :paperId")
    fun deleteByPaperId(paperId: Long): Int
}
