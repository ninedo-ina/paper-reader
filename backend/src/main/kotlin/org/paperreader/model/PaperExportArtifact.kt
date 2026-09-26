package org.paperreader.model

import jakarta.persistence.*
import java.time.Instant

/**
 * 一次导出产物的登记行 / A single export-artifact record.
 *
 * 见 V17__paper_export_artifacts.sql：把导出结果「回挂」到 pr_paper_versions（可空外键
 * [versionId]），而不是另起一套版本系统。登记的是产物元信息，不是正文快照（正文快照属 W6）。
 */
@Entity
@Table(name = "pr_paper_export_artifacts")
data class PaperExportArtifact(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "paper_id", nullable = false)
    val paperId: Long,

    /** 关联的发布版本；草稿（当前正文）导出时为空。 */
    @Column(name = "version_id")
    val versionId: Long? = null,

    @Column(nullable = false, length = 20)
    val format: String,

    @Column(length = 40)
    val engine: String? = null,

    /** 产物落盘的相对路径（相对 app.export.output-dir）。 */
    @Column(name = "file_path", length = 500)
    val filePath: String? = null,

    @Column(name = "byte_size")
    val byteSize: Long? = null,

    /** 导出时论文正文的 content_version 快照。 */
    @Column(name = "content_version")
    val contentVersion: Int? = null,

    @Column(nullable = false, length = 20)
    val status: String = "success",

    @Column(name = "created_by", nullable = false)
    val createdBy: Long,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),
)
