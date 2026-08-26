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
@Table(name = "pr_paper_metadata_sources")
data class PaperMetadataSource(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(nullable = false)
    val paperId: Long,
    @Column(nullable = false)
    val userId: Long,
    val resolutionId: Long? = null,
    @Column(nullable = false, length = 40)
    val provider: String,
    @Column(length = 500)
    val externalId: String? = null,
    @Column(length = 1000)
    val recordUrl: String? = null,
    @Column(nullable = false, length = 40)
    val matchMethod: String,
    @Column(nullable = false)
    val confidence: Double = 0.0,
    @Column(nullable = false, length = 20)
    val status: String = "SUCCESS",
    @Column(length = 80)
    val errorCode: String? = null,
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    val payload: String? = null,
    @Column(nullable = false)
    val fetchedAt: Instant = Instant.now(),
)
