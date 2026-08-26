package org.paperreader.dto

import com.fasterxml.jackson.annotation.JsonInclude
import java.time.Instant

data class MetadataResolveRequest(
    /** Optional exact DOI/arXiv identifier. Failing that, the paper URL/TEI is inspected. */
    val identifier: String? = null,
)

data class MetadataApplyRequest(
    /** Candidate field names selected in the preview. Omitted means fill empty fields only. */
    val fields: List<String>? = null,
)

@JsonInclude(JsonInclude.Include.NON_NULL)
data class MetadataFieldCandidateDto(
    val field: String,
    val currentValue: String?,
    val suggestedValue: String?,
    val source: String?,
    val recordUrl: String?,
    val matchMethod: String = "EXACT_ID",
    val confidence: Double,
    val conflict: Boolean,
    val selectedByDefault: Boolean,
)

@JsonInclude(JsonInclude.Include.NON_NULL)
data class MetadataManifestationDto(
    val type: String,
    val label: String,
    val fields: List<MetadataFieldCandidateDto>,
)

data class MetadataSourceDto(
    val id: Long,
    val provider: String,
    val externalId: String?,
    val recordUrl: String?,
    val matchMethod: String,
    val confidence: Double,
    val status: String,
    val errorCode: String?,
    val fetchedAt: Instant,
)

data class MetadataResolutionDto(
    val id: Long,
    val paperId: Long,
    val expectedUpdatedAt: Instant,
    val expiresAt: Instant,
    val createdAt: Instant,
    val identifiers: Map<String, String>,
    val fields: List<MetadataFieldCandidateDto>,
    val manifestations: List<MetadataManifestationDto> = emptyList(),
    val sources: List<MetadataSourceDto> = emptyList(),
    val warnings: List<String> = emptyList(),
)

data class MetadataApplyResponse(
    val paper: PaperDetailDto,
    val appliedFields: List<String>,
)
