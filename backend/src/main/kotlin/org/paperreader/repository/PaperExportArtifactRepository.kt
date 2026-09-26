package org.paperreader.repository

import org.paperreader.model.PaperExportArtifact
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.stereotype.Repository
import org.springframework.transaction.annotation.Transactional

@Repository
interface PaperExportArtifactRepository : JpaRepository<PaperExportArtifact, Long> {
    fun findByPaperIdOrderByCreatedAtDesc(paperId: Long): List<PaperExportArtifact>

    fun findByIdAndPaperId(id: Long, paperId: Long): PaperExportArtifact?

    /**
     * 同一篇论文、同一版本槽（versionId 可空）、同一格式的历史产物 —— 新导出前先删旧的，
     * 保证每个 (paper, version, format) 只留最新一份，磁盘不会无界增长。
     * versionId 为空用 IS NULL 语义单独查（JPA 的 nullable 派生查询在 H2/PG 上都成立）。
     */
    fun findByPaperIdAndVersionIdAndFormat(paperId: Long, versionId: Long?, format: String): List<PaperExportArtifact>

    fun findByPaperIdAndVersionIdIsNullAndFormat(paperId: Long, format: String): List<PaperExportArtifact>

    @Modifying
    @Transactional
    @Query("delete from PaperExportArtifact a where a.paperId = :paperId")
    fun deleteByPaperId(paperId: Long): Int
}
