package org.paperreader.model

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "pr_paper_metadata_field_provenance")
data class PaperMetadataFieldProvenance(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(nullable = false)
    val paperId: Long,
    @Column(nullable = false)
    val userId: Long,
    val resolutionId: Long? = null,
    @Column(nullable = false, length = 120)
    val fieldName: String,
    @Column(nullable = false, columnDefinition = "TEXT")
    val valueText: String,
    @Column(nullable = false, length = 40)
    val provider: String,
    @Column(length = 1000)
    val recordUrl: String? = null,
    @Column(nullable = false, length = 40)
    val matchMethod: String,
    @Column(nullable = false)
    val confidence: Double = 0.0,
    @Column(nullable = false)
    val userConfirmed: Boolean = true,
    @Column(nullable = false)
    val appliedAt: Instant = Instant.now(),
)
