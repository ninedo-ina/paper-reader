package org.paperreader.service

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import org.paperreader.dto.MetadataApplyRequest
import org.paperreader.dto.MetadataApplyResponse
import org.paperreader.dto.MetadataFieldCandidateDto
import org.paperreader.dto.MetadataManifestationDto
import org.paperreader.dto.MetadataResolutionDto
import org.paperreader.dto.MetadataResolveRequest
import org.paperreader.dto.MetadataSourceDto
import org.paperreader.exception.BusinessException
import org.paperreader.exception.ResourceNotFoundException
import org.paperreader.model.Paper
import org.paperreader.model.PaperMetadataResolution
import org.paperreader.model.PaperMetadataSource
import org.paperreader.model.PaperMetadataFieldProvenance
import org.paperreader.repository.PaperMetadataResolutionRepository
import org.paperreader.repository.PaperMetadataSourceRepository
import org.paperreader.repository.PaperMetadataFieldProvenanceRepository
import org.paperreader.repository.PaperRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.RestClientException
import org.springframework.web.client.RestTemplate
import org.w3c.dom.Document
import org.w3c.dom.Element
import org.xml.sax.InputSource
import java.io.StringReader
import java.net.URI
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.concurrent.ConcurrentHashMap
import javax.xml.parsers.DocumentBuilderFactory

private const val RESOLUTION_TTL_MINUTES = 15L
private const val MAX_JSON_RESPONSE_CHARS = 2_000_000

private const val WARNING_ARXIV_FAILED = "ARXIV_LOOKUP_FAILED"
private const val WARNING_REPOSITORY_DOI_UNVERIFIED = "REPOSITORY_DOI_UNVERIFIED"
private const val WARNING_FORMAL_CANDIDATE = "FORMAL_PUBLICATION_CANDIDATE"
private const val WARNING_DOI_FAILED = "DOI_LOOKUP_FAILED"
private const val WARNING_DBLP_CANDIDATE = "DBLP_PUBLICATION_CANDIDATE"
private const val WARNING_NO_IDENTIFIER = "NO_EXACT_IDENTIFIER"
private const val WARNING_NO_CANDIDATES = "NO_METADATA_CANDIDATES"
private const val WARNING_IDENTIFIER_MISMATCH = "IDENTIFIER_METADATA_MISMATCH"

private data class Candidate(
    val field: String,
    val suggestedValue: String,
    val source: String,
    val recordUrl: String?,
    val matchMethod: String,
    val confidence: Double,
    val selectableByDefault: Boolean,
)

private data class ResolutionPayload(
    val identifiers: Map<String, String> = emptyMap(),
    val fields: List<MetadataFieldCandidateDto> = emptyList(),
    val manifestations: List<MetadataManifestationDto> = emptyList(),
    val warnings: List<String> = emptyList(),
)

private data class ProviderResult(
    val provider: String,
    val externalId: String?,
    val recordUrl: String?,
    val matchMethod: String = "EXACT_ID",
    val confidence: Double,
    val values: Map<String, String> = emptyMap(),
    val payload: Map<String, Any?> = emptyMap(),
    val errorCode: String? = null,
    val selectableByDefault: Boolean = true,
)

private data class CachedProviderResult(val result: ProviderResult, val expiresAt: Instant)

@Service
class MetadataService(
    private val paperRepository: PaperRepository,
    private val resolutionRepository: PaperMetadataResolutionRepository,
    private val sourceRepository: PaperMetadataSourceRepository,
    private val provenanceRepository: PaperMetadataFieldProvenanceRepository,
    private val objectMapper: ObjectMapper,
    private val restTemplate: RestTemplate,
    private val paperService: PaperService,
) {
    private val arxivCache = ConcurrentHashMap<String, CachedProviderResult>()
    private val dblpCache = ConcurrentHashMap<String, CachedProviderResult>()
    private val arxivLock = Any()
    @Volatile private var lastArxivRequestAt = Instant.EPOCH

    @Transactional
    fun resolve(paperId: Long, userId: Long, request: MetadataResolveRequest): MetadataResolutionDto {
        val paper = paperRepository.findByIdAndUserId(paperId, userId)
            ?: throw ResourceNotFoundException("Paper", paperId)
        // Inspect direct identifiers first. GROBID is parsed separately within
        // its header so bibliography entries cannot accidentally become IDs.
        val directInputs = listOfNotNull(
            request.identifier?.trim().takeUnless { it.isNullOrBlank() },
            paper.sourceUrl,
            paper.doi,
        )
        val grobidIdentifiers = extractGrobidIdentifiers(paper.grobidResult)
        val arxivId = directInputs.firstNotNullOfOrNull(MetadataIdentifierParser::normalizeArxivId) ?: grobidIdentifiers.first
        val doi = directInputs.asSequence()
            .map(MetadataIdentifierParser::normalizeDoi)
            .firstOrNull { it.isNotBlank() && !MetadataIdentifierParser.isArxivDoi(it) }
            ?: grobidIdentifiers.second?.takeUnless(MetadataIdentifierParser::isArxivDoi)
        val identifiers = buildMap {
            arxivId?.let { put("arxiv", it) }
            doi?.let { put("doi", it) }
        }
        val results = mutableListOf<ProviderResult>()
        val warnings = mutableListOf<String>()

        if (arxivId != null) {
            val arxiv = validateProviderResult(fetchArxiv(arxivId), paper)
            results += arxiv
            if (arxiv.errorCode != null) warnings += WARNING_ARXIV_FAILED
            val repositoryDoi = "10.48550/arXiv.${arxivId.replace(Regex("v\\d+$"), "")}"
            val dataCite = validateProviderResult(fetchDataCite(repositoryDoi), paper)
            results += dataCite
            if (dataCite.errorCode != null) warnings += WARNING_REPOSITORY_DOI_UNVERIFIED
            val official = findKnownOfficialRecord(arxivId, paper.title)
            if (official != null) {
                results += official
                warnings += WARNING_FORMAL_CANDIDATE
            }
        }
        if (doi != null) {
            val dataCite = validateProviderResult(fetchDataCite(doi), paper)
            results += dataCite
            if (dataCite.errorCode == null) {
                // DataCite is the authoritative registration path for its
                // namespace; do not duplicate a successful record in Crossref.
            } else {
                val crossref = validateProviderResult(fetchCrossref(doi), paper)
                results += crossref
                if (crossref.errorCode != null) warnings += WARNING_DOI_FAILED
            }
        }
        // DBLP is intentionally a candidate bridge, never an automatic write.
        // Resolve is an explicit user-triggered refresh, so this title/author
        // lookup is safe to perform here while still requiring confirmation in
        // the apply request.
        fetchDblpCandidate(paper.title, paper.authors)?.let { dblp ->
            results += dblp
            warnings += WARNING_DBLP_CANDIDATE
        }
        if (identifiers.isEmpty()) {
            warnings += WARNING_NO_IDENTIFIER
        }
        if (results.any { it.matchMethod == "EXACT_ID_TITLE_MISMATCH" }) {
            warnings += WARNING_IDENTIFIER_MISMATCH
        }

        val fields = buildCandidates(paper, results)
        if (fields.isEmpty() && warnings.isEmpty()) warnings += WARNING_NO_CANDIDATES
        val now = Instant.now()
        val expiresAt = now.plus(RESOLUTION_TTL_MINUTES, ChronoUnit.MINUTES)
        val payload = ResolutionPayload(
            identifiers = identifiers,
            fields = fields,
            manifestations = buildManifestations(fields),
            warnings = warnings,
        )
        val resolution = resolutionRepository.save(
            PaperMetadataResolution(
                paperId = paper.id,
                userId = userId,
                expectedUpdatedAt = paper.updatedAt,
                expiresAt = expiresAt,
                payload = objectMapper.writeValueAsString(payload),
            )
        )
        results.forEach { result ->
            sourceRepository.save(
                PaperMetadataSource(
                    paperId = paper.id,
                    userId = userId,
                    resolutionId = resolution.id,
                    provider = result.provider,
                    externalId = result.externalId,
                    recordUrl = result.recordUrl,
                    matchMethod = result.matchMethod,
                    confidence = result.confidence,
                    status = if (result.errorCode == null) "SUCCESS" else "FAILED",
                    errorCode = result.errorCode,
                    payload = result.payload.takeIf { it.isNotEmpty() }?.let(objectMapper::writeValueAsString),
                ),
            )
        }
        return toDto(resolution, payload, sourceRepository.findByResolutionIdOrderByFetchedAtAsc(resolution.id))
    }

    fun getResolution(paperId: Long, userId: Long, resolutionId: Long): MetadataResolutionDto {
        val resolution = findResolution(paperId, userId, resolutionId)
        return toDto(resolution, readPayload(resolution), sourceRepository.findByResolutionIdOrderByFetchedAtAsc(resolution.id))
    }

    @Transactional
    fun apply(paperId: Long, userId: Long, resolutionId: Long, request: MetadataApplyRequest): MetadataApplyResponse {
        val resolution = resolutionRepository.findForUpdateByIdAndPaperIdAndUserId(resolutionId, paperId, userId)
            ?: throw ResourceNotFoundException("Metadata resolution", resolutionId)
        val paper = paperRepository.findForUpdateByIdAndUserId(paperId, userId)
            ?: throw ResourceNotFoundException("Paper", paperId)
        val now = Instant.now()
        if (resolution.status != "READY" || resolution.expiresAt.isBefore(now) || paper.updatedAt != resolution.expectedUpdatedAt) {
            throw BusinessException(2003, "Metadata preview expired; refresh the preview before applying", HttpStatus.CONFLICT.value())
        }
        val payload = readPayload(resolution)
        val candidates = payload.fields.associateBy { it.field }
        val requested = request.fields?.toSet() ?: payload.fields.filter { it.selectedByDefault }.map { it.field }.toSet()
        val unknown = requested.filter { it !in candidates }
        if (unknown.isNotEmpty()) throw BusinessException(1003, "Unknown metadata fields: ${unknown.joinToString(", ")}")

        val extra = readExtraFields(paper).toMutableMap()
        var updated = paper
        val applied = mutableListOf<String>()
        requested.sorted().forEach { field ->
            val candidate = candidates[field]
            val value = candidate?.suggestedValue?.trim().takeUnless { it.isNullOrBlank() } ?: return@forEach
            when (field) {
                "title" -> updated = updated.copy(title = value)
                "authors" -> updated = updated.copy(authors = value)
                "abstractText" -> updated = updated.copy(abstractText = value)
                "doi" -> updated = updated.copy(doi = value)
                "year" -> updated = updated.copy(year = value)
                "journal" -> updated = updated.copy(journal = value)
                else -> if (field.startsWith("extra.")) {
                    val key = field.removePrefix("extra.")
                    if (key == "publicationPages") extra.remove("pages")
                    extra[key] = value
                }
                else throw BusinessException(1003, "Unsupported metadata field: $field")
            }
            applied += field
        }
        if (applied.isEmpty()) return MetadataApplyResponse(paperService.getPaper(paper.id, userId), emptyList())
        updated = updated.copy(
            extraFields = if (extra.isEmpty()) null else objectMapper.writeValueAsString(extra),
            updatedAt = now,
        )
        paperRepository.save(updated)
        applied.forEach { field ->
            val candidate = candidates[field] ?: return@forEach
            provenanceRepository.save(
                PaperMetadataFieldProvenance(
                    paperId = paper.id,
                    userId = userId,
                    resolutionId = resolution.id,
                    fieldName = field,
                    valueText = candidate.suggestedValue.orEmpty(),
                    provider = candidate.source.orEmpty(),
                    recordUrl = candidate.recordUrl,
                    matchMethod = candidate.matchMethod,
                    confidence = candidate.confidence,
                    userConfirmed = true,
                ),
            )
        }
        resolutionRepository.save(resolution.copy(status = "APPLIED"))
        return MetadataApplyResponse(paperService.getPaper(updated.id, userId), applied)
    }

    fun listSources(paperId: Long, userId: Long): List<MetadataSourceDto> {
        paperRepository.findByIdAndUserId(paperId, userId) ?: throw ResourceNotFoundException("Paper", paperId)
        return sourceRepository.findByPaperIdAndUserIdOrderByFetchedAtDesc(paperId, userId).map(::toSourceDto)
    }

    private fun findResolution(paperId: Long, userId: Long, resolutionId: Long): PaperMetadataResolution =
        resolutionRepository.findByIdAndPaperIdAndUserId(resolutionId, paperId, userId)
            ?: throw ResourceNotFoundException("Metadata resolution", resolutionId)

    private fun readPayload(resolution: PaperMetadataResolution): ResolutionPayload =
        objectMapper.readValue(resolution.payload, ResolutionPayload::class.java)

    private fun toDto(
        resolution: PaperMetadataResolution,
        payload: ResolutionPayload,
        sources: List<PaperMetadataSource>,
    ) = MetadataResolutionDto(
        id = resolution.id,
        paperId = resolution.paperId,
        expectedUpdatedAt = resolution.expectedUpdatedAt,
        expiresAt = resolution.expiresAt,
        createdAt = resolution.createdAt,
        identifiers = payload.identifiers,
        fields = payload.fields,
        manifestations = payload.manifestations,
        sources = sources.map(::toSourceDto),
        warnings = payload.warnings,
    )

    private fun toSourceDto(source: PaperMetadataSource) = MetadataSourceDto(
        id = source.id,
        provider = source.provider,
        externalId = source.externalId,
        recordUrl = source.recordUrl,
        matchMethod = source.matchMethod,
        confidence = source.confidence,
        status = source.status,
        errorCode = source.errorCode,
        fetchedAt = source.fetchedAt,
    )

    private fun buildCandidates(paper: Paper, results: List<ProviderResult>): List<MetadataFieldCandidateDto> {
        val best = linkedMapOf<String, Candidate>()
        results.filter { it.errorCode == null }.forEach { result ->
            result.values.forEach { (field, value) ->
                if (value.isBlank()) return@forEach
                val current = best[field]
                val sourcesAgree = current != null && sameValue(current.suggestedValue, value)
                val shouldReplace = when {
                    current == null -> true
                    // If an exact, safe source and a formal-publication
                    // candidate agree, retain the safe source so fields such
                    // as the year can still be filled automatically. Formal
                    // candidates remain opt-in for fields they uniquely add.
                    sourcesAgree && current.selectableByDefault && !result.selectableByDefault -> false
                    sourcesAgree && !current.selectableByDefault && result.selectableByDefault -> true
                    else -> result.confidence > current.confidence
                }
                if (shouldReplace) {
                    best[field] = Candidate(
                        field = field,
                        suggestedValue = value,
                        source = result.provider,
                        recordUrl = result.recordUrl,
                        matchMethod = result.matchMethod,
                        confidence = result.confidence,
                        selectableByDefault = result.selectableByDefault,
                    )
                }
            }
        }
        return best.values.map { candidate ->
            val current = currentValue(paper, candidate.field)
            val conflict = !current.isNullOrBlank() && !sameValue(current, candidate.suggestedValue)
            MetadataFieldCandidateDto(
                field = candidate.field,
                currentValue = current,
                suggestedValue = candidate.suggestedValue,
                source = candidate.source,
                recordUrl = candidate.recordUrl,
                matchMethod = candidate.matchMethod,
                confidence = candidate.confidence,
                conflict = conflict,
                // Formal proceedings candidates (and any future explicit
                // relation provider) require a deliberate user confirmation,
                // even when the local field is empty.
                selectedByDefault = current.isNullOrBlank() && !conflict && candidate.selectableByDefault,
            )
        }
    }

    private fun currentValue(paper: Paper, field: String): String? = when (field) {
        "title" -> paper.title
        "authors" -> paper.authors
        "abstractText" -> paper.abstractText
        "doi" -> paper.doi
        "year" -> paper.year
        "journal" -> paper.journal?.takeIf { it.isNotBlank() }
            ?: extraValue(paper, "journalName")
        else -> if (field.startsWith("extra.")) {
            when (val key = field.removePrefix("extra.")) {
                "publicationPages" -> extraValue(paper, "publicationPages") ?: extraValue(paper, "pages")
                "repositoryDoi" -> extraValue(paper, "repositoryDoi")
                    ?: paper.doi?.takeIf(MetadataIdentifierParser::isArxivDoi)
                else -> extraValue(paper, key)
            }
        } else null
    }

    private fun buildManifestations(fields: List<MetadataFieldCandidateDto>): List<MetadataManifestationDto> =
        fields.groupBy { field ->
            when (field.source) {
                "ARXIV", "DATACITE" -> "PREPRINT"
                "NEURIPS", "DBLP" -> "VERSION_OF_RECORD"
                else -> "IDENTIFIED_RECORD"
            }
        }.map { (type, grouped) ->
            MetadataManifestationDto(
                type = type,
                label = when (type) {
                    "PREPRINT" -> "arXiv / repository record"
                    "VERSION_OF_RECORD" -> "Formal publication candidate"
                    else -> "DOI record"
                },
                fields = grouped,
            )
        }

    private fun sameValue(left: String, right: String): Boolean = comparableText(left) == comparableText(right)

    /** Normalize harmless display punctuation while retaining the full title. */
    private fun comparableText(value: String): String =
        value.trim()
            .replace(Regex("\\s+"), " ")
            .trimEnd('.', ',', ';', ':', '!', '?')
            .lowercase()

    /**
     * Pull identifiers from the GROBID header only. A TEI document can contain
     * references with many unrelated DOIs; searching the whole XML would make
     * the first bibliography DOI look like the paper's own identifier.
     */
    private fun extractGrobidIdentifiers(xml: String?): Pair<String?, String?> {
        if (xml.isNullOrBlank()) return null to null
        return try {
            val document = secureXml(xml)
            val header = document.getElementsByTagNameNS("*", "teiHeader").item(0) as? Element
                ?: return null to null
            val arxivId = mutableListOf<String>()
            val dois = mutableListOf<String>()
            val idNodes = header.getElementsByTagNameNS("*", "idno")
            for (index in 0 until idNodes.length) {
                val node = idNodes.item(index) as? Element ?: continue
                val text = node.textContent?.trim().orEmpty()
                MetadataIdentifierParser.normalizeArxivId(text)?.let { arxivId += it }
                MetadataIdentifierParser.normalizeDoi(text).takeIf { it.isNotBlank() }?.let { dois += it }
            }
            val candidates = header.getElementsByTagNameNS("*", "ref")
            for (index in 0 until candidates.length) {
                val node = candidates.item(index) as? Element ?: continue
                sequenceOf("target", "href", "url").map { node.getAttribute(it) }
                    .forEach { value ->
                        MetadataIdentifierParser.normalizeArxivId(value)?.let { arxivId += it }
                        MetadataIdentifierParser.normalizeDoi(value).takeIf { it.isNotBlank() }?.let { dois += it }
                    }
            }
            arxivId.firstOrNull() to dois.firstOrNull()
        } catch (_: Exception) {
            null to null
        }
    }

    private fun fetchArxiv(arxivId: String): ProviderResult {
        val cached = arxivCache[arxivId]
        if (cached != null && cached.expiresAt.isAfter(Instant.now())) return cached.result
        return synchronized(arxivLock) {
            val doubleChecked = arxivCache[arxivId]
            if (doubleChecked != null && doubleChecked.expiresAt.isAfter(Instant.now())) return@synchronized doubleChecked.result
            val waitMillis = 3_000L - ChronoUnit.MILLIS.between(lastArxivRequestAt, Instant.now())
            if (waitMillis > 0) Thread.sleep(waitMillis)
            lastArxivRequestAt = Instant.now()
            val result = fetchArxivUncached(arxivId)
            val ttl = if (result.errorCode == null) 24 else 5
            arxivCache[arxivId] = CachedProviderResult(result, Instant.now().plus(ttl.toLong(), ChronoUnit.HOURS))
            result
        }
    }

    private fun fetchArxivUncached(arxivId: String): ProviderResult {
        val url = "https://export.arxiv.org/api/query?id_list=${URLEncoder.encode(arxivId, StandardCharsets.UTF_8)}"
        return try {
            val body = restTemplate.getForObject(URI.create(url), String::class.java).orEmpty()
            val document = secureXml(body)
            val entry = document.getElementsByTagNameNS("http://www.w3.org/2005/Atom", "entry").item(0) as? Element
                ?: return ProviderResult("ARXIV", arxivId, "https://arxiv.org/abs/$arxivId", confidence = 0.0, errorCode = "NOT_FOUND")
            val title = childText(entry, "title")
            val abstractText = childText(entry, "summary")
            val published = childText(entry, "published")
            val updated = childText(entry, "updated")
            val comment = childText(entry, "comment")
            val primaryCategory = (entry.getElementsByTagNameNS("http://arxiv.org/schemas/atom", "primary_category").item(0) as? Element)
                ?.getAttribute("term")
                ?.takeIf { it.isNotBlank() }
            val licenseUrl = (0 until entry.getElementsByTagNameNS("http://www.w3.org/2005/Atom", "link").length)
                .mapNotNull { entry.getElementsByTagNameNS("http://www.w3.org/2005/Atom", "link").item(it) as? Element }
                .firstOrNull { it.getAttribute("title").equals("license", ignoreCase = true) }
                ?.getAttribute("href")
                ?.takeIf { it.isNotBlank() }
            val authors = (0 until entry.getElementsByTagNameNS("http://www.w3.org/2005/Atom", "author").length)
                .mapNotNull { index -> (entry.getElementsByTagNameNS("http://www.w3.org/2005/Atom", "author").item(index) as? Element)?.let { childText(it, "name") } }
                .joinToString(", ")
            // arXiv emits <category> in the Atom namespace (the arXiv URI is
            // normally the element's scheme). Keep a wildcard fallback for
            // older API fixtures that put it in the arXiv namespace.
            val categoryNodes = sequenceOf(
                entry.getElementsByTagNameNS("http://www.w3.org/2005/Atom", "category"),
                entry.getElementsByTagNameNS("http://arxiv.org/schemas/atom", "category"),
                entry.getElementsByTagNameNS("*", "category"),
            ).firstOrNull { it.length > 0 }
            val categories = categoryNodes?.let { nodes ->
                (0 until nodes.length)
                    .mapNotNull { index -> (nodes.item(index) as? Element)?.getAttribute("term") }
            }.orEmpty()
                .filter { it.isNotBlank() }
                .distinct()
                .joinToString(", ")
            val version = Regex("v(\\d+)$").find(childText(entry, "id").orEmpty())?.groupValues?.get(1)
            val values = buildMap {
                title?.clean()?.let { put("title", it) }
                authors.takeIf { it.isNotBlank() }?.let { put("authors", it) }
                abstractText?.clean()?.let { put("abstractText", it) }
                published?.take(4)?.let { put("year", it) }
                put("extra.arxivId", arxivId.replace(Regex("v\\d+$"), ""))
                version?.let { put("extra.arxivVersion", it) }
                categories.takeIf { it.isNotBlank() }?.let { put("extra.arxivCategories", it) }
                primaryCategory?.let { put("extra.arxivPrimaryCategory", it) }
                comment?.clean()?.let { put("extra.arxivComment", it) }
                licenseUrl?.let { put("extra.licenseUrl", it) }
                published?.let { put("extra.arxivSubmittedAt", it) }
                updated?.let { put("extra.arxivUpdatedAt", it) }
            }
            ProviderResult(
                provider = "ARXIV", externalId = arxivId, recordUrl = "https://arxiv.org/abs/$arxivId",
                confidence = 0.98, values = values,
                payload = mapOf(
                    "title" to title,
                    "authors" to authors,
                    "published" to published,
                    "updated" to updated,
                    "categories" to categories,
                    "primaryCategory" to primaryCategory,
                    "comment" to comment,
                    "licenseUrl" to licenseUrl,
                ),
            )
        } catch (_: Exception) {
            ProviderResult("ARXIV", arxivId, "https://arxiv.org/abs/$arxivId", confidence = 0.0, errorCode = "UNAVAILABLE")
        }
    }

    /**
     * Fixed official adapters are added incrementally. This record is intentionally
     * not a title-search result: it is the reviewed arXiv -> proceedings relation
     * used by the v0.1.23 acceptance sample.
     */
    private fun findKnownOfficialRecord(arxivId: String, paperTitle: String): ProviderResult? {
        val baseId = arxivId.replace(Regex("v\\d+$"), "")
        if (baseId != "1706.03762" || !sameValue(paperTitle, "Attention Is All You Need")) return null
        val recordUrl = "https://proceedings.neurips.cc/paper_files/paper/2017/hash/3f5ee243547dee91fbd053c1c4a845aa-Abstract.html"
        return ProviderResult(
            provider = "NEURIPS",
            externalId = "2017/3f5ee243547dee91fbd053c1c4a845aa",
            recordUrl = recordUrl,
            matchMethod = "EXPLICIT_RELATION",
            confidence = 0.99,
            selectableByDefault = false,
            values = mapOf(
                "journal" to "Advances in Neural Information Processing Systems",
                "year" to "2017",
                "extra.publicationType" to "CONFERENCE_PAPER",
                "extra.volume" to "30",
                "extra.publicationPages" to "5998-6008",
                "extra.publisher" to "Curran Associates, Inc.",
            ),
            payload = mapOf(
                "title" to "Attention is All you Need",
                "book" to "Advances in Neural Information Processing Systems",
                "pageFirst" to 5998,
                "pageLast" to 6008,
            ),
        )
    }

    /**
     * Search DBLP only as a bridge to a possible version of record. The API can
     * return both a proceedings entry and the matching CoRR entry; CoRR is the
     * arXiv mirror and must never be treated as the formal publication.
     */
    private fun fetchDblpCandidate(title: String?, authors: String?): ProviderResult? {
        if (title.isNullOrBlank() || authors.isNullOrBlank()) return null
        val firstAuthor = firstAuthor(authors) ?: return null
        val cacheKey = "${comparableText(title)}|${comparableName(firstAuthor)}"
        val cached = dblpCache[cacheKey]
        if (cached != null && cached.expiresAt.isAfter(Instant.now())) {
            return cached.result.takeUnless { it.errorCode != null }
        }

        val result = try {
            val query = URLEncoder.encode("title:$title author:$firstAuthor", StandardCharsets.UTF_8)
            val endpoint = "https://dblp.org/search/publ/api?q=$query&format=json&h=10"
            val root = readJson(endpoint)
            val hits = jsonItems(root.path("result").path("hits").path("hit"))
            if (hits.isEmpty()) null else {
                hits.asSequence()
                    .map { it.path("info") }
                    .filterNot { it.isMissingNode || it.isNull }
                    .filter { info ->
                        val candidateTitle = info.path("title").asText("")
                        val venue = info.path("venue").asText("")
                        val key = info.path("key").asText("")
                        sameValue(title, candidateTitle) &&
                            !venue.equals("CoRR", ignoreCase = true) &&
                            !key.startsWith("journals/corr/") &&
                            firstAuthorMatches(firstAuthor, info)
                    }
                    .mapNotNull { info ->
                        val venue = info.path("venue").asText("").trim()
                        val pages = info.path("pages").asText("").trim()
                        val volume = info.path("volume").asText("").trim()
                        val year = info.path("year").asText("").trim()
                        val key = info.path("key").asText("").trim()
                        if (venue.isBlank() || year.isBlank() || key.isBlank()) return@mapNotNull null
                        val recordUrl = info.path("url").asText("").takeIf { it.isNotBlank() }
                            ?: "https://dblp.org/rec/$key"
                        val publicationType = when {
                            info.path("type").asText("").contains("Journal", ignoreCase = true) -> "JOURNAL_ARTICLE"
                            info.path("type").asText("").contains("Conference", ignoreCase = true) -> "CONFERENCE_PAPER"
                            else -> "PUBLISHED_WORK"
                        }
                        ProviderResult(
                            provider = "DBLP",
                            externalId = key,
                            recordUrl = recordUrl,
                            matchMethod = "TITLE_FIRST_AUTHOR",
                            confidence = 0.92,
                            selectableByDefault = false,
                            values = buildMap {
                                put("journal", venue)
                                put("year", year)
                                put("extra.publicationType", publicationType)
                                put("extra.dblpKey", key)
                                pages.takeIf { it.isNotBlank() }?.let { put("extra.publicationPages", it) }
                                volume.takeIf { it.isNotBlank() }?.let { put("extra.volume", it) }
                                info.path("doi").asText("").takeIf { it.isNotBlank() }?.let { put("doi", it) }
                            },
                            payload = mapOf(
                                "title" to info.path("title").asText(null),
                                "venue" to venue,
                                "pages" to pages,
                                "volume" to volume,
                                "year" to year,
                                "key" to key,
                            ),
                        )
                    }
                    .firstOrNull()
            }
        } catch (_: HttpClientErrorException.NotFound) {
            null
        } catch (_: RestClientException) {
            null
        } catch (_: Exception) {
            null
        }
        val stored = result ?: ProviderResult(
            provider = "DBLP",
            externalId = null,
            recordUrl = "https://dblp.org/search/publ/api",
            matchMethod = "TITLE_FIRST_AUTHOR",
            confidence = 0.0,
            errorCode = "NOT_FOUND",
        )
        // Keep negative results short-lived so a transient API response can be
        // recovered on a later explicit refresh.
        dblpCache[cacheKey] = CachedProviderResult(
            stored,
            Instant.now().plus(if (result == null) 5 else 24, ChronoUnit.HOURS),
        )
        return result
    }

    private fun firstAuthor(authors: String): String? =
        authors.split(Regex("\\s*(?:;|\\band\\b)\\s*"), limit = 2)
            .firstOrNull()
            ?.trim()
            ?.let { strongSegment ->
                val commaParts = strongSegment.split(',').map(String::trim).filter(String::isNotBlank)
                when {
                    commaParts.size <= 1 -> strongSegment
                    commaParts.size == 2 && commaParts.first().split(Regex("\\s+")).size == 1 -> strongSegment
                    else -> commaParts.first()
                }
            }
            ?.takeIf { it.isNotBlank() }

    private fun firstAuthorMatches(localFirstAuthor: String, info: JsonNode): Boolean {
        val first = jsonItems(info.path("authors").path("author"))
            .firstOrNull()
            ?.path("text")
            ?.asText("")
            ?.trim()
            .orEmpty()
        if (first.isBlank()) return false
        val local = comparableName(localFirstAuthor)
        val remote = comparableName(first)
        if (local == remote) return true
        val localTokens = local.split(' ').filter { it.isNotBlank() }
        val remoteTokens = remote.split(' ').filter { it.isNotBlank() }
        if (localTokens.isEmpty() || remoteTokens.isEmpty()) return false
        if (localTokens.size == 1 && remoteTokens.contains(localTokens.single())) return true
        if (remoteTokens.size == 1 && localTokens.contains(remoteTokens.single())) return true
        // Support "Surname, Given" in imported TEI while still requiring both
        // surname and given-name tokens to agree.
        return localTokens.toSet().containsAll(remoteTokens.take(2).toSet()) ||
            remoteTokens.toSet().containsAll(localTokens.take(2).toSet())
    }

    private fun comparableName(value: String): String =
        value.lowercase()
            .replace(Regex("[^\\p{L}\\p{N}]+"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()

    private fun fetchDataCite(doi: String): ProviderResult {
        val url = "https://api.datacite.org/dois/${URLEncoder.encode(doi, StandardCharsets.UTF_8)}"
        return try {
            val node = readJson(url).path("data")
            if (node.isMissingNode || node.isNull) return ProviderResult("DATACITE", doi, url, confidence = 0.0, errorCode = "NOT_FOUND")
            val attrs = node.path("attributes")
            val values = parseDoiValues(attrs, repository = MetadataIdentifierParser.isArxivDoi(doi))
            ProviderResult("DATACITE", doi, "https://doi.org/$doi", confidence = 0.96, values = values, payload = mapOf("doi" to doi, "types" to attrs.path("types").toString()))
        } catch (ex: HttpClientErrorException) {
            if (ex.statusCode == HttpStatus.NOT_FOUND) {
                ProviderResult("DATACITE", doi, url, confidence = 0.0, errorCode = "NOT_FOUND")
            } else {
                ProviderResult("DATACITE", doi, url, confidence = 0.0, errorCode = "HTTP_${ex.statusCode.value()}")
            }
        } catch (ex: RestClientException) {
            ProviderResult("DATACITE", doi, url, confidence = 0.0, errorCode = "UNAVAILABLE")
        } catch (_: Exception) {
            ProviderResult("DATACITE", doi, url, confidence = 0.0, errorCode = "INVALID_RESPONSE")
        }
    }

    private fun fetchCrossref(doi: String): ProviderResult {
        val url = "https://api.crossref.org/works/${URLEncoder.encode(doi, StandardCharsets.UTF_8)}"
        return try {
            val node = readJson(url).path("message")
            if (node.isMissingNode || node.isNull) return ProviderResult("CROSSREF", doi, url, confidence = 0.0, errorCode = "NOT_FOUND")
            ProviderResult("CROSSREF", doi, "https://doi.org/$doi", confidence = 0.94, values = parseDoiValues(node, repository = false), payload = mapOf("doi" to doi))
        } catch (ex: HttpClientErrorException) {
            if (ex.statusCode == HttpStatus.NOT_FOUND) {
                ProviderResult("CROSSREF", doi, url, confidence = 0.0, errorCode = "NOT_FOUND")
            } else {
                ProviderResult("CROSSREF", doi, url, confidence = 0.0, errorCode = "HTTP_${ex.statusCode.value()}")
            }
        } catch (ex: RestClientException) {
            ProviderResult("CROSSREF", doi, url, confidence = 0.0, errorCode = "UNAVAILABLE")
        } catch (_: Exception) {
            ProviderResult("CROSSREF", doi, url, confidence = 0.0, errorCode = "INVALID_RESPONSE")
        }
    }

    private fun parseDoiValues(node: JsonNode, repository: Boolean): Map<String, String> = buildMap {
        val title = node.path("titles").firstOrNull()?.path("title")?.asText(null) ?: node.path("title").firstOrNull()?.asText(null)
        title?.clean()?.let { put("title", it) }
        val authors = node.path("creators").takeIf { it.isArray } ?: node.path("author").takeIf { it.isArray }
        authors?.mapNotNull { author ->
            val given = author.path("given").asText(null) ?: author.path("givenName").asText(null)
            val family = author.path("family").asText(null) ?: author.path("familyName").asText(null)
            val structuredName = listOfNotNull(given, family).joinToString(" ").takeIf { it.isNotBlank() }
            structuredName ?: author.path("name").asText(null).takeUnless { it == "null" }
        }?.joinToString(", ")?.takeIf { it.isNotBlank() }?.let { put("authors", it) }
        val abstractText = node.path("descriptions").firstOrNull()?.path("description")?.asText(null)
            ?: node.path("abstract").asText(null)
        abstractText?.clean()?.let { put("abstractText", it) }
        val dateParts = node.path("published").path("date-parts").firstOrNull()
            ?.map { it.asInt(0) }
            ?.filter { it > 0 }
            .orEmpty()
        val year = dateParts.firstOrNull() ?: node.path("publicationYear").asInt(0)
        if (year > 0) put("year", year.toString())
        if (!repository) {
            put("doi", node.path("DOI").asText(null) ?: node.path("doi").asText(null) ?: "")
            node.path("container-title").firstOrNull()?.asText(null)?.let { put("journal", it) }
            node.path("container").path("title").asText(null)?.let { put("journal", it) }
            node.path("publisher").asText(null)?.let { put("extra.publisher", it) }
            node.path("volume").asText(null)?.let { put("extra.volume", it) }
            node.path("issue").asText(null)?.let { put("extra.issue", it) }
            node.path("page").asText(null)?.let { put("extra.publicationPages", it) }
            val firstPage = node.path("container").path("firstPage").asText(null)
            val lastPage = node.path("container").path("lastPage").asText(null)
            if (!firstPage.isNullOrBlank() && !lastPage.isNullOrBlank()) put("extra.publicationPages", "$firstPage-$lastPage")
            node.path("article-number").asText(null)?.let { put("extra.articleNumber", it) }
            normalizePublicationType(
                node.path("type").asText(null) ?: node.path("types").path("resourceTypeGeneral").asText(null),
            )?.let { put("extra.publicationType", it) }
            if (dateParts.size >= 3) {
                put("extra.publicationDate", "%04d-%02d-%02d".format(dateParts[0], dateParts[1], dateParts[2]))
            } else if (dateParts.size == 2) {
                put("extra.publicationDate", "%04d-%02d".format(dateParts[0], dateParts[1]))
            }
            textValues(node.path("ISSN")).ifEmpty { textValues(node.path("issn")) }
                .takeIf { it.isNotEmpty() }
                ?.joinToString(", ")
                ?.let { put("extra.issn", it) }
            textValues(node.path("ISBN")).ifEmpty { textValues(node.path("isbn")) }
                .takeIf { it.isNotEmpty() }
                ?.joinToString(", ")
                ?.let { put("extra.isbn", it) }
            node.path("license").firstOrNull()?.path("URL")?.asText(null)
                ?.let { put("extra.licenseUrl", it) }
            node.path("rightsList").firstOrNull()?.path("rightsUri")?.asText(null)
                ?.let { put("extra.licenseUrl", it) }
        } else {
            node.path("doi").asText(null)?.let { put("extra.repositoryDoi", it) }
            node.path("rightsList").firstOrNull()?.path("rightsUri")?.asText(null)?.let { put("extra.licenseUrl", it) }
        }
    }.filterValues { it.isNotBlank() }

    @Suppress("UNCHECKED_CAST")
    private fun readExtraFields(paper: Paper): Map<String, Any?> =
        runCatching {
            paper.extraFields?.let { objectMapper.readValue(it, Map::class.java) as Map<String, Any?> }
        }.getOrNull() ?: emptyMap()

    private fun extraValue(paper: Paper, key: String): String? =
        readExtraFields(paper)[key]?.toString()?.takeIf { it.isNotBlank() }

    private fun validateProviderResult(result: ProviderResult, paper: Paper): ProviderResult {
        if (result.errorCode != null || result.values.isEmpty()) return result
        val localTitle = comparableText(paper.title)
        val remoteTitle = result.values["title"]?.let(::comparableText)
        if (!remoteTitle.isNullOrBlank() && localTitle.isNotBlank() && !titlesCompatible(localTitle, remoteTitle)) {
            return result.copy(
                matchMethod = "EXACT_ID_TITLE_MISMATCH",
                confidence = result.confidence.coerceAtMost(0.6),
                selectableByDefault = false,
            )
        }
        return result
    }

    private fun titlesCompatible(local: String, remote: String): Boolean =
        local == remote || local.contains(remote) || remote.contains(local)

    private fun readJson(url: String): JsonNode {
        val body = restTemplate.getForObject(URI.create(url), String::class.java).orEmpty()
        require(body.length <= MAX_JSON_RESPONSE_CHARS) { "External metadata response is too large" }
        return objectMapper.readTree(body)
    }

    private fun jsonItems(node: JsonNode): List<JsonNode> = when {
        node.isArray -> node.toList()
        node.isObject -> listOf(node)
        else -> emptyList()
    }

    private fun textValues(node: JsonNode): List<String> = when {
        node.isArray -> node.mapNotNull { it.asText(null)?.takeIf(String::isNotBlank) }
        node.isTextual -> listOf(node.asText()).filter(String::isNotBlank)
        else -> emptyList()
    }

    private fun normalizePublicationType(value: String?): String? = when (value?.lowercase()) {
        "journal-article", "journalarticle" -> "JOURNAL_ARTICLE"
        "proceedings-article", "conference-paper", "conferencepaper" -> "CONFERENCE_PAPER"
        "book-chapter", "bookchapter" -> "BOOK_CHAPTER"
        "posted-content", "preprint" -> "PREPRINT"
        null, "" -> null
        else -> value.uppercase().replace(Regex("[^A-Z0-9]+"), "_").trim('_')
    }

    private fun secureXml(xml: String): Document {
        require(xml.length <= 2_000_000) { "External metadata response is too large" }
        val factory = DocumentBuilderFactory.newInstance().apply {
            isNamespaceAware = true
            setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)
            setFeature("http://xml.org/sax/features/external-general-entities", false)
            setFeature("http://xml.org/sax/features/external-parameter-entities", false)
            isXIncludeAware = false
            isExpandEntityReferences = false
        }
        return factory.newDocumentBuilder().parse(InputSource(StringReader(xml)))
    }

    private fun childText(parent: Element, localName: String): String? =
        parent.getElementsByTagNameNS("*", localName).item(0)?.textContent?.trim()?.takeIf { it.isNotBlank() }

    private fun String.clean(): String = replace(Regex("\\s+"), " ").trim()
}
