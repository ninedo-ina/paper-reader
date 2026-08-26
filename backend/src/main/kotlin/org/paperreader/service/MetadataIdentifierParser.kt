package org.paperreader.service

import java.net.URLDecoder
import java.nio.charset.StandardCharsets

/** Normalizes user-, URL-, and TEI-supplied academic identifiers. */
internal object MetadataIdentifierParser {
    private val explicitArxivPattern = Regex(
        "(?i)(?:arxiv:\\s*|arxiv\\.org/(?:abs|pdf)/|10\\.48550/arxiv\\.)" +
            "([a-z][a-z0-9.-]*/\\d{7}|\\d{4}\\.\\d{4,5})(v\\d+)?",
    )
    private val standaloneArxivPattern = Regex(
        "(?i)^\\s*([a-z][a-z0-9.-]*/\\d{7}|\\d{4}\\.\\d{4,5})(v\\d+)?(?:\\.pdf)?\\s*$",
    )
    private val doiPattern = Regex("(?i)10\\.\\d{4,9}/[-._;()/:a-z0-9+]+")

    fun normalizeArxivId(value: String?): String? {
        if (value.isNullOrBlank()) return null
        val text = decodePercentEscapes(value.trim())
        val match = explicitArxivPattern.find(text) ?: standaloneArxivPattern.find(text) ?: return null
        return match.groupValues[1].lowercase() + match.groupValues[2].lowercase()
    }

    fun normalizeDoi(value: String?): String {
        if (value.isNullOrBlank()) return ""
        val text = decodePercentEscapes(value.trim()).replace("doi:", "", ignoreCase = true)
        val match = doiPattern.find(text) ?: return ""
        var normalized = match.value.trimEnd('.', ',', ';', ']', '}', '>')
        while (normalized.endsWith(')') && normalized.count { it == ')' } > normalized.count { it == '(' }) {
            normalized = normalized.dropLast(1)
        }
        return normalized.lowercase()
    }

    fun isArxivDoi(doi: String): Boolean = doi.startsWith("10.48550/arxiv.", ignoreCase = true)

    private fun decodePercentEscapes(value: String): String =
        if ('%' in value) runCatching { URLDecoder.decode(value, StandardCharsets.UTF_8) }.getOrDefault(value) else value
}
