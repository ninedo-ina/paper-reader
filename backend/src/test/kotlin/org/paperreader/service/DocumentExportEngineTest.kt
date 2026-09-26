package org.paperreader.service

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.paperreader.config.ExportProperties
import org.paperreader.exception.ExportUnavailableException
import org.paperreader.exception.InvalidParameterException

/**
 * 引擎单测只覆盖不依赖真实 pandoc/typst 的部分：数学公式的正反向映射（纯函数）与前置闸门
 * （输入大小、引擎缺失）。真实转换保真度在集成/线上验收里走真实引擎。
 * 引擎路径故意指向不存在的文件，isAvailable=false，因此绝不会 fork 进程。
 */
class DocumentExportEngineTest {
    private val props = ExportProperties().apply {
        pandocPath = "/nonexistent/pandoc"
        typstPath = "/nonexistent/typst"
        maxInputBytes = 1_000
    }
    private val engine = DocumentExportEngine(props)

    @Test
    fun `preprocess rebuilds inline math as tex delimiters and drops katex render dom`() {
        // 编辑器 getHTML() 里的行内公式：data-latex + 一堆 KaTeX 渲染 span（会让 pandoc 出重复/乱码）
        val html = """<p>能量 <span data-type="inline-math" data-latex="E = mc^2" class="tiptap-mathematics-render"><span class="katex"><span class="katex-html">EMC junk glyphs</span></span></span> 完</p>"""
        val out = engine.preprocessMathForPandoc(html)

        assertTrue(out.contains("""\(E = mc^2\)"""), out)
        // KaTeX 的可见字形被丢弃，避免 pandoc 把渲染 DOM 也当正文读进去
        assertFalse(out.contains("EMC junk glyphs"), out)
    }

    @Test
    fun `preprocess marks block math with display delimiters`() {
        val html = """<div data-type="block-math" data-latex="\int_0^1 x dx"><span class="katex">rendered</span></div>"""
        val out = engine.preprocessMathForPandoc(html)

        assertTrue(out.contains("""\[\int_0^1 x dx\]"""), out)
        assertFalse(out.contains("rendered"), out)
    }

    @Test
    fun `preprocess escapes xml-significant characters in latex`() {
        val html = """<p><span data-type="inline-math" data-latex="a < b & c">x</span></p>"""
        val out = engine.preprocessMathForPandoc(html)

        assertTrue(out.contains("a &lt; b &amp; c"), out)
    }

    @Test
    fun `pandoc math spans map back to editor math nodes on import`() {
        val html = """<p>see <span class="math inline">\(x^2\)</span> and</p><p><span class="math display">\[\sum_i a_i\]</span></p>"""
        val out = engine.pandocHtmlToEditor(html)

        assertTrue(out.contains("data-type=\"inline-math\""), out)
        assertTrue(out.contains("data-latex=\"x^2\""), out)
        assertTrue(out.contains("data-type=\"block-math\""), out)
        assertTrue(out.contains("data-latex=\"\\sum_i a_i\""), out)
    }

    @Test
    fun `export rejects oversize input before touching any engine`() {
        val big = "<p>" + "x".repeat(2_000) + "</p>"
        assertThrows<InvalidParameterException> {
            engine.export(ExportFormat.MARKDOWN, big, null, "t")
        }
    }

    @Test
    fun `export rejects blank content`() {
        assertThrows<InvalidParameterException> {
            engine.export(ExportFormat.HTML, "   ", null, "t")
        }
    }

    @Test
    fun `bibtex export rejects missing references`() {
        assertThrows<InvalidParameterException> {
            engine.export(ExportFormat.BIBTEX, null, null, "t")
        }
    }

    @Test
    fun `export reports engine unavailable when binary missing`() {
        assertThrows<ExportUnavailableException> {
            engine.export(ExportFormat.MARKDOWN, "<p>ok</p>", null, "t")
        }
    }

    @Test
    fun `capabilities reflect missing binaries`() {
        assertFalse(engine.isAvailable(ExportFormat.PDF))
        assertFalse(engine.isAvailable(ExportFormat.MARKDOWN))
        assertFalse(engine.isImportAvailable())
    }

    @Test
    fun `format id lookup is case-insensitive and rejects unknown`() {
        assertEquals(ExportFormat.PDF, ExportFormat.fromId("PDF"))
        assertEquals(ExportFormat.BIBTEX, ExportFormat.fromId("bibtex"))
        assertEquals(null, ExportFormat.fromId("rtf"))
    }
}
