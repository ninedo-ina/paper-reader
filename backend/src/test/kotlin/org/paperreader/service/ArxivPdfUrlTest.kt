package org.paperreader.service

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

/**
 * arXiv 的 /html/、/abs/ 是网页，直接当 PDF 下下来只会得到一坨 HTML（用户 2634182127@qq.com
 * 就是这么踩的：https://arxiv.org/html/2609.25851v1）。同一篇的 PDF 在 /pdf/ 下。
 */
class ArxivPdfUrlTest {
    @Test
    fun `rewrites an html paper page to its pdf`() {
        assertEquals(
            "https://arxiv.org/pdf/2609.25851v1",
            ArxivPdfUrl.normalize("https://arxiv.org/html/2609.25851v1"),
        )
    }

    @Test
    fun `rewrites an abs abstract page to its pdf`() {
        assertEquals(
            "https://arxiv.org/pdf/2609.25851",
            ArxivPdfUrl.normalize("https://arxiv.org/abs/2609.25851"),
        )
    }

    @Test
    fun `keeps an old style id with a subdirectory`() {
        assertEquals(
            "https://arxiv.org/pdf/math.GT/0309136",
            ArxivPdfUrl.normalize("https://arxiv.org/abs/math.GT/0309136"),
        )
    }

    @Test
    fun `keeps http and the www host as given`() {
        assertEquals(
            "http://www.arxiv.org/pdf/2609.25851v1",
            ArxivPdfUrl.normalize("http://www.arxiv.org/html/2609.25851v1"),
        )
    }

    @Test
    fun `leaves an already correct pdf url alone`() {
        assertEquals(
            "https://arxiv.org/pdf/2609.25851v1",
            ArxivPdfUrl.normalize("https://arxiv.org/pdf/2609.25851v1"),
        )
    }

    @Test
    fun `leaves other hosts and other paths alone`() {
        val untouched = listOf(
            "https://example.com/html/2609.25851v1",
            "https://arxiv.org/list/cs.CL/recent",
            "https://arxiv.org/",
            "not a url at all",
        )

        untouched.forEach { assertEquals(it, ArxivPdfUrl.normalize(it)) }
    }
}
