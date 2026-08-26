package org.paperreader.repository

import org.paperreader.model.PaperMetadataFieldProvenance
import org.springframework.data.jpa.repository.JpaRepository

interface PaperMetadataFieldProvenanceRepository : JpaRepository<PaperMetadataFieldProvenance, Long> {
    fun deleteByPaperId(paperId: Long)
}
