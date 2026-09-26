package org.paperreader.service

import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Assumptions.assumeTrue
import org.junit.jupiter.api.Test
import org.paperreader.config.ExportProperties
import java.io.File

/**
 * 真实引擎集成测试：直接 fork 真实 pandoc / typst，验证从 ProcessBuilder → stdin → 临时目录 → 读回字节
 * 的完整链路，以及公式（\(...\) 定界）在各目标格式里的保真。没装引擎的环境（如 CI）会被 assumeTrue 跳过，
 * 不影响构建。服务器上装了 pandoc + typst + Noto CJK 字体，本测试会实际跑起来。
 */
class DocumentExportEngineIntegrationTest {
    private val pandoc = "/usr/bin/pandoc"
    private val typst = "/usr/local/bin/typst"
    private val engine = DocumentExportEngine(
        ExportProperties().apply {
            pandocPath = pandoc
            typstPath = typst
        },
    )

    // 编辑器 getHTML() 的真实形态：行内公式是 data-latex + KaTeX 渲染 DOM，混排中文
    private val html = """
        <h1>能量方程 Energy</h1>
        <p>著名公式 <span data-type="inline-math" data-latex="E = mc^2"><span class="katex">EMCJUNK</span></span> 众所周知。</p>
        <div data-type="block-math" data-latex="\int_0^1 x^2 \, dx = \frac{1}{3}"><span class="katex">BLOCKJUNK</span></div>
    """.trimIndent()

    private fun havePandoc() = File(pandoc).canExecute()

    @Test
    fun `real pandoc exports markdown with math as dollars and no katex junk`() {
        assumeTrue(havePandoc(), "pandoc 未安装，跳过")
        val md = engine.export(ExportFormat.MARKDOWN, html, null, "能量方程").toString(Charsets.UTF_8)
        assertTrue(md.contains("\$E = mc^2\$"), md)
        assertTrue(md.contains("\$\$\\int_0^1 x^2 \\, dx = \\frac{1}{3}\$\$"), md)
        assertTrue(md.contains("能量方程"), md) // CJK 保留
        assertTrue(!md.contains("EMCJUNK") && !md.contains("BLOCKJUNK"), md) // KaTeX 字形被丢弃
    }

    @Test
    fun `real pandoc exports latex preserving tex math`() {
        assumeTrue(havePandoc(), "pandoc 未安装，跳过")
        val tex = engine.export(ExportFormat.LATEX, html, null, "能量方程").toString(Charsets.UTF_8)
        assertTrue(tex.contains("E = mc^2"), tex)
        assertTrue(tex.contains("\\frac{1}{3}") && !tex.contains("textbackslash frac"), tex) // 真数学，非转义文本
    }

    @Test
    fun `real typst exports a valid pdf`() {
        assumeTrue(havePandoc() && File(typst).canExecute(), "pandoc/typst 未安装，跳过")
        val pdf = engine.export(ExportFormat.PDF, html, null, "能量方程")
        assertTrue(pdf.size > 1000, "PDF 太小: ${pdf.size}")
        val header = pdf.copyOfRange(0, 4).toString(Charsets.US_ASCII)
        assertTrue(header == "%PDF", "不是合法 PDF header: $header")
    }

    @Test
    fun `real pandoc imports markdown math back into editor nodes`() {
        assumeTrue(havePandoc(), "pandoc 未安装，跳过")
        val out = engine.importMarkdown("# 标题\n\n行内 \$x^2\$ 与行间：\n\n\$\$\\sum_i a_i\$\$\n")
        assertTrue(out.contains("data-type=\"inline-math\"") && out.contains("data-latex=\"x^2\""), out)
        assertTrue(out.contains("data-type=\"block-math\"") && out.contains("data-latex=\"\\sum_i a_i\""), out)
    }
}
