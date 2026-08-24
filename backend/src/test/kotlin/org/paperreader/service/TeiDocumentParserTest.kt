package org.paperreader.service

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class TeiDocumentParserTest {
    private val parser = TeiDocumentParser()

    @Test
    fun `extracts metadata sections and bounded chunks from TEI`() {
        val result = parser.parse(
            """
            <TEI>
              <teiHeader>
                <fileDesc>
                  <titleStmt><title>Example Paper</title><author><persName><forename>Ada</forename><surname>Lovelace</surname></persName></author></titleStmt>
                  <publicationStmt><date>2024</date></publicationStmt>
                  <sourceDesc><biblStruct><monogr><title>Example Journal</title></monogr><idno type="DOI">10.1000/example</idno></biblStruct></sourceDesc>
                </fileDesc>
                <profileDesc><abstract><p>An abstract.</p></abstract></profileDesc>
              </teiHeader>
              <text><body>
                <div><head>Introduction</head><pb n="1"/><p>First paragraph with enough context.</p><p>Second paragraph.</p></div>
                <div><head>Method</head><p>Method paragraph.</p></div>
              </body></text>
            </TEI>
            """.trimIndent(),
        )

        assertEquals("Example Paper", result.metadata.title)
        assertEquals("Ada Lovelace", result.metadata.authors)
        assertEquals("An abstract.", result.metadata.abstractText)
        assertEquals("10.1000/example", result.metadata.doi)
        assertEquals("2024", result.metadata.year)
        assertEquals("Example Journal", result.metadata.journal)
        assertEquals(3, result.chunks.size)
        assertEquals("Introduction", result.chunks[0].sectionTitle)
        assertEquals(1, result.chunks[0].pageStart)
        assertTrue(result.chunks.any { it.sectionTitle == "Method" && it.content == "Method paragraph." })
    }

    @Test
    fun `reads page breaks from namespaced TEI`() {
        val result = parser.parse(
            """
            <TEI xmlns="http://www.tei-c.org/ns/1.0">
              <text><body>
                <div><pb n="3"/><p>Page three.</p><pb n="4"/><p>Page four.</p></div>
              </body></text>
            </TEI>
            """.trimIndent(),
        )

        assertEquals(4, result.metadata.pageCount)
        assertEquals(3, result.chunks[0].pageStart)
        assertEquals(4, result.chunks[1].pageStart)
    }

    @Test
    fun `supports namespaced TEI documents`() {
        val result = parser.parse(
            """
            <tei:TEI xmlns:tei="http://www.tei-c.org/ns/1.0">
              <tei:teiHeader>
                <tei:fileDesc>
                  <tei:titleStmt><tei:title>Namespaced Paper</tei:title></tei:titleStmt>
                  <tei:sourceDesc><tei:biblStruct><tei:analytic>
                    <tei:author><tei:persName><tei:forename>Grace</tei:forename><tei:surname>Hopper</tei:surname></tei:persName></tei:author>
                  </tei:analytic></tei:biblStruct></tei:sourceDesc>
                </tei:fileDesc>
              </tei:teiHeader>
              <tei:text><tei:body><tei:div><tei:head>Results</tei:head><tei:p>Namespaced content.</tei:p></tei:div></tei:body></tei:text>
            </tei:TEI>
            """.trimIndent(),
        )

        assertEquals("Namespaced Paper", result.metadata.title)
        assertEquals("Grace Hopper", result.metadata.authors)
        assertEquals("Results", result.chunks.single().sectionTitle)
        assertEquals("Namespaced content.", result.chunks.single().content)
    }

    @Test
    fun `reads analytic authors and date attributes from the header`() {
        val result = parser.parse(
            """
            <TEI xmlns="http://www.tei-c.org/ns/1.0">
              <teiHeader>
                <fileDesc>
                  <titleStmt><title>Header Paper</title></titleStmt>
                  <publicationStmt><date when="2023-08-02">2 Aug 2023</date></publicationStmt>
                  <sourceDesc><biblStruct><analytic>
                    <author><persName><forename>Aidan</forename><forename>N</forename><surname>Gomez</surname></persName></author>
                  </analytic></biblStruct></sourceDesc>
                </fileDesc>
              </teiHeader>
              <text><body><p>Body.</p></body></text>
            </TEI>
            """.trimIndent(),
        )

        assertEquals("Aidan N Gomez", result.metadata.authors)
        assertEquals("2023", result.metadata.year)
    }

    @Test
    fun `does not read metadata or page breaks outside their TEI scopes`() {
        val result = parser.parse(
            """
            <TEI>
              <teiHeader><fileDesc><titleStmt><title>Actual Paper</title></titleStmt></fileDesc></teiHeader>
              <text>
                <body><pb n="2"/><p>Paper body.</p></body>
                <back><pb n="99"/><div>
                  <title>Reference Title</title>
                  <author><persName><forename>Reference</forename><surname>Author</surname></persName></author>
                  <abstract>Reference abstract.</abstract>
                  <idno type="DOI">10.1000/reference</idno>
                  <date>1999</date>
                  <monogr><title>Reference Journal</title></monogr>
                </div></back>
              </text>
            </TEI>
            """.trimIndent(),
        )

        assertEquals("Actual Paper", result.metadata.title)
        assertEquals(null, result.metadata.authors)
        assertEquals(null, result.metadata.abstractText)
        assertEquals(null, result.metadata.doi)
        assertEquals(null, result.metadata.year)
        assertEquals(null, result.metadata.journal)
        assertEquals(2, result.metadata.pageCount)
    }

    @Test
    fun `rejects XML external entities`() {
        val malicious = """
            <!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
            <TEI><text><body><p>&xxe;</p></body></text></TEI>
        """.trimIndent()

        org.junit.jupiter.api.Assertions.assertThrows(Exception::class.java) {
            parser.parse(malicious)
        }
    }
}
