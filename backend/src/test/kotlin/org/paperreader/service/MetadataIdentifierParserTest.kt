package org.paperreader.service

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class MetadataIdentifierParserTest {
    @Test
    fun `normalizes modern arxiv forms and preserves version`() {
        assertEquals("1706.03762", MetadataIdentifierParser.normalizeArxivId("1706.03762"))
        assertEquals("1706.03762v7", MetadataIdentifierParser.normalizeArxivId("arXiv:1706.03762v7"))
        assertEquals("1706.03762v7", MetadataIdentifierParser.normalizeArxivId("https://arxiv.org/pdf/1706.03762v7.pdf"))
        assertEquals("1706.03762", MetadataIdentifierParser.normalizeArxivId("https://doi.org/10.48550/arXiv.1706.03762"))
    }

    @Test
    fun `normalizes legacy arxiv forms`() {
        assertEquals("hep-th/9901001v2", MetadataIdentifierParser.normalizeArxivId("hep-th/9901001v2"))
        assertEquals("hep-th/9901001v2", MetadataIdentifierParser.normalizeArxivId("https://arxiv.org/abs/hep-th/9901001v2"))
    }

    @Test
    fun `normalizes doi labels percent escapes and punctuation`() {
        assertEquals("10.1000/example", MetadataIdentifierParser.normalizeDoi(" DOI: https://doi.org/10.1000/EXAMPLE. "))
        assertEquals("10.1000/foo(bar)", MetadataIdentifierParser.normalizeDoi("10.1000/foo%28bar%29"))
        assertTrue(MetadataIdentifierParser.isArxivDoi("10.48550/arXiv.1706.03762"))
        assertNull(MetadataIdentifierParser.normalizeArxivId("not-an-arxiv-id"))
    }
}
