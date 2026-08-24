package org.paperreader.model

import jakarta.persistence.*

@Entity
@Table(
    name = "pr_paper_chunks",
    uniqueConstraints = [UniqueConstraint(columnNames = ["paper_id", "ordinal"])],
)
data class PaperChunk(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "paper_id", nullable = false)
    val paperId: Long,

    @Column(name = "section_title", length = 500)
    val sectionTitle: String? = null,

    @Column(nullable = false)
    val ordinal: Int,

    @Column(columnDefinition = "TEXT", nullable = false)
    val content: String,

    @Column(name = "page_start")
    val pageStart: Int? = null,

    @Column(name = "page_end")
    val pageEnd: Int? = null,
)
