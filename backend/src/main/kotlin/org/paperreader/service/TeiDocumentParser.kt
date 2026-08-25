package org.paperreader.service

import org.springframework.stereotype.Component
import org.w3c.dom.Document
import org.w3c.dom.Element
import org.w3c.dom.Node
import java.io.StringReader
import javax.xml.parsers.DocumentBuilderFactory
import org.xml.sax.InputSource

data class TeiMetadata(
    val title: String?,
    val authors: String?,
    val abstractText: String?,
    val doi: String?,
    val year: String?,
    val journal: String?,
    val pageCount: Int?,
)

data class TeiChunk(
    val sectionTitle: String?,
    val content: String,
    val pageStart: Int?,
    val pageEnd: Int?,
)

data class TeiDocument(
    val metadata: TeiMetadata,
    val chunks: List<TeiChunk>,
)

@Component
class TeiDocumentParser {
    fun parse(teiXml: String): TeiDocument {
        val document = secureDocument(teiXml)
        val header = firstElement(document, "teiHeader")
        val body = firstElement(document, "body")
        val pages = body?.let { elements(it, "pb") }?.let { nodes ->
            (0 until nodes.length).mapNotNull { index ->
                (nodes.item(index) as? Element)?.getAttribute("n")?.toIntOrNull()
            }
        }.orEmpty()

        val metadata = TeiMetadata(
            title = header?.let(::findTitle),
            authors = header?.let(::parseAuthors),
            abstractText = header?.let { firstText(it, "abstract") },
            doi = header?.let(::findDoi),
            year = header?.let(::findYear),
            journal = header?.let(::findJournal),
            pageCount = pages.maxOrNull(),
        )

        return TeiDocument(metadata, extractChunks(document))
    }

    private fun secureDocument(teiXml: String): Document {
        val factory = DocumentBuilderFactory.newInstance()
        factory.isNamespaceAware = true
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false)
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false)
        factory.isXIncludeAware = false
        factory.isExpandEntityReferences = false
        return factory.newDocumentBuilder().parse(InputSource(StringReader(teiXml)))
    }

    private fun firstText(parent: Element, tag: String): String? =
        elements(parent, tag).let { nodes ->
            if (nodes.length == 0) null else normalize(nodes.item(0).textContent)
        }

    private fun findTitle(header: Element): String? {
        val titleStatement = firstElement(header, "titleStmt")
        val title = titleStatement?.let { firstText(it, "title") }
        if (!title.isNullOrBlank()) return cleanTitle(title)

        return firstElement(header, "analytic")?.let { firstText(it, "title") }?.let(::cleanTitle)
    }

    /**
     * Removes known publisher boilerplate that GROBID can merge into a main title.
     *
     * This deliberately does not try to infer a title by length, capitalization, or
     * sentence position: those heuristics can damage legitimate long paper titles.
     * If a known leading statement is the entire value (or leaves no title-like
     * content), the normalized original is retained.
     */
    private fun cleanTitle(value: String): String {
        val normalized = normalize(value)
        val cleaned = LEADING_TITLE_BOILERPLATE_PATTERNS.firstNotNullOfOrNull { pattern ->
            pattern.find(normalized)?.let { match ->
                normalized.removeRange(match.range).trim()
            }
        }

        return cleaned
            ?.takeIf { candidate -> candidate.any { it.isLetterOrDigit() } }
            ?: normalized
    }

    private fun parseAuthors(header: Element): String? {
        val titleStatement = firstElement(header, "titleStmt")
        val analytic = firstElement(header, "analytic")
        val scopes = when {
            titleStatement == null && analytic == null -> listOf(header)
            else -> listOfNotNull(titleStatement, analytic)
        }
        val authorNodes = scopes.firstNotNullOfOrNull { scope ->
            elements(scope, "author").takeIf { it.length > 0 }
        } ?: return null

        return (0 until authorNodes.length).mapNotNull { index ->
            val author = authorNodes.item(index)
            val surname = descendantText(author, "surname")
            val forenames = descendantTexts(author, "forename")
            when {
                surname != null && forenames.isNotEmpty() -> "${forenames.joinToString(" ")} $surname"
                surname != null -> surname
                else -> normalize(author.textContent)
            }
        }.filter { it.isNotBlank() }.joinToString(", ").takeIf { it.isNotBlank() }
    }

    private fun findDoi(header: Element): String? {
        val nodes = elements(header, "idno")
        return (0 until nodes.length).firstNotNullOfOrNull { index ->
            val node = nodes.item(index) as? Element
            if (node?.getAttribute("type")?.equals("DOI", ignoreCase = true) == true) {
                normalize(node.textContent)
            } else null
        }
    }

    private fun findYear(header: Element): String? {
        val nodes = elements(header, "date")
        return (0 until nodes.length).firstNotNullOfOrNull { index ->
            val date = nodes.item(index) as? Element ?: return@firstNotNullOfOrNull null
            val candidates = listOf(date.getAttribute("when"), normalize(date.textContent))
            candidates.firstNotNullOfOrNull { value -> YEAR_PATTERN.find(value)?.value }
        }
    }

    private fun findJournal(header: Element): String? {
        val nodes = elements(header, "monogr")
        if (nodes.length == 0) return null
        return (0 until nodes.length).firstNotNullOfOrNull { index ->
            (nodes.item(index) as? Element)?.let { firstText(it, "title") }
        }
    }

    private fun extractChunks(document: Document): List<TeiChunk> {
        val bodies = elements(document, "body")
        if (bodies.length == 0) return emptyList()

        val raw = mutableListOf<TeiChunk>()
        val state = WalkState()
        walk(bodies.item(0), null, state, raw)

        if (raw.isEmpty()) {
            val fallback = normalize(bodies.item(0).textContent)
            return if (fallback.isBlank()) emptyList() else splitChunk(null, fallback, state.page)
        }

        return raw.flatMap { splitChunk(it.sectionTitle, it.content, it.pageStart) }
    }

    private fun walk(node: Node, sectionTitle: String?, state: WalkState, output: MutableList<TeiChunk>) {
        if (node.nodeType != Node.ELEMENT_NODE) return
        val element = node as Element
        when (localName(element)) {
            "pb" -> {
                state.page = element.getAttribute("n").toIntOrNull() ?: state.page
                return
            }
            "p" -> {
                val text = normalize(element.textContent)
                if (text.isNotBlank()) output += TeiChunk(sectionTitle, text, state.page, state.page)
                return
            }
            "div" -> {
                val heading = directChildText(element, "head") ?: sectionTitle
                val children = element.childNodes
                for (index in 0 until children.length) walk(children.item(index), heading, state, output)
                return
            }
        }

        val children = element.childNodes
        for (index in 0 until children.length) walk(children.item(index), sectionTitle, state, output)
    }

    private fun splitChunk(sectionTitle: String?, content: String, page: Int?): List<TeiChunk> {
        val result = mutableListOf<TeiChunk>()
        var remaining = content
        while (remaining.length > CHUNK_SIZE) {
            val boundary = preferredBoundary(remaining, CHUNK_SIZE)
            result += TeiChunk(sectionTitle, remaining.take(boundary).trim(), page, page)
            remaining = remaining.drop(boundary).trimStart()
        }
        if (remaining.isNotBlank()) result += TeiChunk(sectionTitle, remaining, page, page)
        return result
    }

    private fun preferredBoundary(value: String, limit: Int): Int {
        val punctuation = value.substring(0, limit).indexOfLast { it in "。！？.!?；;" }
        return if (punctuation >= limit / 2) punctuation + 1 else limit
    }

    private fun directChildText(element: Element, tag: String): String? {
        val children = element.childNodes
        for (index in 0 until children.length) {
            val child = children.item(index) as? Element ?: continue
            if (localName(child) == tag) return normalize(child.textContent)
        }
        return null
    }

    private fun descendantText(node: Node, tag: String): String? {
        val element = node as? Element ?: return null
        val nodes = elements(element, tag)
        return if (nodes.length > 0) normalize(nodes.item(0).textContent) else null
    }

    private fun descendantTexts(node: Node, tag: String): List<String> {
        val element = node as? Element ?: return emptyList()
        val nodes = elements(element, tag)
        return (0 until nodes.length).mapNotNull { index ->
            normalize(nodes.item(index).textContent).takeIf { it.isNotBlank() }
        }
    }

    private fun firstElement(parent: Document, tag: String): Element? =
        elements(parent, tag).item(0) as? Element

    private fun firstElement(parent: Element, tag: String): Element? =
        elements(parent, tag).item(0) as? Element

    private fun elements(parent: Document, tag: String) = parent.getElementsByTagNameNS("*", tag)

    private fun elements(parent: Element, tag: String) = parent.getElementsByTagNameNS("*", tag)

    private fun localName(element: Element): String =
        element.localName ?: element.tagName.substringAfterLast(':')

    private fun normalize(value: String?): String = value.orEmpty()
        .replace('\u00ad'.toString(), "")
        .replace(Regex("([A-Za-z])-\\s+([A-Za-z])"), "$1$2")
        .replace(Regex("\\s+"), " ")
        .trim()

    private data class WalkState(var page: Int? = null)

    companion object {
        private const val CHUNK_SIZE = 1800
        private val YEAR_PATTERN = Regex("\\b(?:1[5-9]|20|21)\\d{2}\\b")
        private val LEADING_TITLE_BOILERPLATE_PATTERNS = listOf(
            Regex(
                """^Provided\s+proper\s+attribution\s+is\s+provided,\s*Google\s+hereby\s+grants\s+permission\s+to\s+reproduce\s+the\s+tables\s+and\s+figures\s+in\s+this\s+paper\s+solely\s+for\s+use\s+in\s+journalistic\s+or\s+scholarly\s+works\.\s*""",
                RegexOption.IGNORE_CASE,
            ),
        )
    }
}
