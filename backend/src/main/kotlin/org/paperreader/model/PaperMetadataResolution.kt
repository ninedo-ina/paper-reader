package org.paperreader.model

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.Instant

@Entity
@Table(name = "pr_paper_metadata_resolutions")
data class PaperMetadataResolution(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(nullable = false)
    val paperId: Long,
    @Column(nullable = false)
    val userId: Long,
    @Column(nullable = false)
    val expectedUpdatedAt: Instant,
    @Column(nullable = false)
    val expiresAt: Instant,
    @Column(nullable = false, length = 20)
    val status: String = "READY",
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    val payload: String,
    @Column(nullable = false)
    val createdAt: Instant = Instant.now(),
)
