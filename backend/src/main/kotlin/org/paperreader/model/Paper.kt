package org.paperreader.model

import jakarta.persistence.*
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.Instant

@Entity
@Table(name = "pr_papers")
data class Paper(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false)
    val userId: Long,

    @Column(nullable = false, length = 500)
    val title: String,

    @Column(length = 2000)
    val authors: String? = null,

    @Column(columnDefinition = "TEXT")
    val abstractText: String? = null,

    @Column(length = 2000)
    val participants: String? = null,

    @Column(length = 500)
    val doi: String? = null,

    @Column(length = 50)
    val year: String? = null,

    @Column(length = 200)
    val journal: String? = null,

    @Column(nullable = false, length = 50)
    val category: String = "JOURNAL",

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    val extraFields: String? = null,

    val storageConfigId: Long? = null,

    @Column(nullable = false, length = 50)
    val sourceType: String, // UPLOAD, URL, or MANUAL

    @Column(length = 1000)
    val sourceUrl: String? = null,

    @Column
    val filePath: String? = null,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    val grobidResult: String? = null,

    @Column(nullable = false)
    val pageCount: Int = 0,

    @Column(nullable = false)
    val fileSize: Long = 0,

    @Column(nullable = false)
    val createdAt: Instant = Instant.now(),

    val updatedAt: Instant = Instant.now(),
)
