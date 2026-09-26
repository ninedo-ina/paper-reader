package org.paperreader.service

import org.jsoup.Jsoup
import org.paperreader.config.ExportProperties
import org.paperreader.exception.ExportBusyException
import org.paperreader.exception.ExportFailedException
import org.paperreader.exception.ExportUnavailableException
import org.paperreader.exception.InvalidParameterException
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import java.io.File
import java.io.IOException
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Semaphore
import java.util.concurrent.TimeUnit

/** 支持的导出格式 / Supported export formats. */
enum class ExportFormat(
    val id: String,
    val ext: String,
    val mediaType: String,
    /** 该格式是否需要 typst（PDF 经 pandoc --pdf-engine=typst）。 */
    val needsTypst: Boolean,
) {
    MARKDOWN("markdown", "md", "text/markdown; charset=utf-8", false),
    HTML("html", "html", "text/html; charset=utf-8", false),
    LATEX("latex", "tex", "application/x-tex; charset=utf-8", false),
    BIBTEX("bibtex", "bib", "application/x-bibtex; charset=utf-8", false),
    DOCX("docx", "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", false),
    PDF("pdf", "pdf", "application/pdf", true),
    ;

    companion object {
        fun fromId(id: String?): ExportFormat? = entries.firstOrNull { it.id.equals(id, ignoreCase = true) }
    }
}

/**
 * 文档导出/导入引擎 / Document export & import engine。
 *
 * 直接以独立进程调用 pandoc / typst（无 shell、参数以数组传递，杜绝命令注入）。W5 风险条款要求的
 * 五道闸门全部在这里落地：
 *   1. 超时      —— [ExportProperties.timeoutMs]，超时 destroyForcibly；
 *   2. 并发上限  —— [semaphore]，满了返回 429（ExportBusyException）；
 *   3. 临时目录隔离 —— 每次导出建独立 temp 目录，finally 递归删除；
 *   4. 输入大小上限 —— 引擎前先量正文字节数，超了 400；
 *   5. 错误脱敏  —— stderr/路径/堆栈只落服务端日志，对外只给通用文案。
 *
 * 数学公式保真：编辑器 getHTML() 里公式是 KaTeX 渲染 DOM（含 data-latex），pandoc 读不了；
 * 导出前把每个 [data-latex] 重建成 \(...\) / \[...\] 定界公式，并以 tex_math_single_backslash
 * 读取器扩展让 pandoc 解析成真正的 Math 节点，即可无损还原 LaTeX（见 [preprocessMathForPandoc]）。
 * 导入时做反向映射（见 [pandocHtmlToEditor]）。
 */
@Component
class DocumentExportEngine(
    private val props: ExportProperties,
) {
    private val logger = LoggerFactory.getLogger(DocumentExportEngine::class.java)
    private val utf8 = StandardCharsets.UTF_8

    /**
     * pandoc 的 HTML 读取器默认不认公式；开 tex_math_single_backslash 后，正文里的 \(...\) / \[...\]
     * 会被解析成真正的 Math 节点（实测：注解式 MathML 和 class=math 的 span 都会被当普通文本转义掉）。
     */
    private val htmlReader = "html+tex_math_single_backslash"
    private val semaphore = Semaphore(props.maxConcurrency.coerceAtLeast(1))
    private val executableCache = ConcurrentHashMap<String, Boolean>()

    // ---------------------------------------------------------------- capability

    /** 该格式所需引擎是否在服务端可用。 */
    fun isAvailable(format: ExportFormat): Boolean {
        if (!isExecutable(props.pandocPath)) return false
        if (format.needsTypst && !isExecutable(props.typstPath)) return false
        return true
    }

    /** pandoc 是否可用（Markdown 导入所需）。 */
    fun isImportAvailable(): Boolean = isExecutable(props.pandocPath)

    private fun ensureAvailable(format: ExportFormat) {
        if (!isAvailable(format)) {
            throw ExportUnavailableException("导出引擎不可用：${format.id}")
        }
    }

    private fun isExecutable(path: String): Boolean = executableCache.getOrPut(path) {
        runCatching { File(path).canExecute() }.getOrDefault(false)
    }

    // ---------------------------------------------------------------- export

    /**
     * 导出为指定格式，返回产物字节。BibTeX 用 [cslJson]（CSL-JSON 数组）作输入，其余格式用 [contentHtml]。
     *
     * 闸门顺序：先校验输入（大小/空 —— 客户端错误，400），再查引擎可用性（服务端能力，503），
     * 再取并发许可（429），最后在独立临时目录里跑引擎（超时 + 脱敏）。
     */
    fun export(format: ExportFormat, contentHtml: String?, cslJson: String?, title: String): ByteArray {
        val stdin: ByteArray = if (format == ExportFormat.BIBTEX) {
            val json = cslJson?.takeIf { it.isNotBlank() }
                ?: throw InvalidParameterException("这篇论文没有可导出的参考文献")
            val bytes = json.toByteArray(utf8)
            checkSize(bytes.size.toLong())
            bytes
        } else {
            val html = contentHtml?.takeIf { it.isNotBlank() }
                ?: throw InvalidParameterException("正文为空，无法导出")
            checkSize(html.toByteArray(utf8).size.toLong())
            preprocessMathForPandoc(html).toByteArray(utf8)
        }

        ensureAvailable(format)

        return withPermit {
            runInTempDir { dir ->
                val out = dir.resolve("out.${format.ext}")
                runProcess(buildCommand(format, out, title), dir, stdin)
                val bytes = runCatching { Files.readAllBytes(out) }.getOrElse {
                    logger.warn("Export output unreadable: format={} err={}", format.id, it.javaClass.simpleName)
                    throw ExportFailedException()
                }
                if (bytes.isEmpty()) {
                    logger.warn("Export produced empty output: format={}", format.id)
                    throw ExportFailedException()
                }
                bytes
            }
        }
    }

    private fun buildCommand(format: ExportFormat, out: Path, title: String): List<String> {
        val outPath = out.toString()
        val safeTitle = title.replace(Regex("[\\r\\n\\t]"), " ").trim().take(200).ifBlank { "Untitled" }
        return when (format) {
            ExportFormat.MARKDOWN -> listOf(
                props.pandocPath, "-f", htmlReader, "-t", "gfm+tex_math_dollars", "--wrap=preserve", "-o", outPath,
            )
            ExportFormat.HTML -> listOf(
                props.pandocPath, "-f", htmlReader, "-t", "html5", "--standalone", "--mathml",
                "--metadata", "title=$safeTitle", "-o", outPath,
            )
            ExportFormat.LATEX -> listOf(
                props.pandocPath, "-f", htmlReader, "-t", "latex", "--standalone",
                "--metadata", "title=$safeTitle", "-o", outPath,
            )
            ExportFormat.DOCX -> listOf(props.pandocPath, "-f", htmlReader, "-t", "docx", "-o", outPath)
            ExportFormat.BIBTEX -> listOf(props.pandocPath, "-f", "csljson", "-t", "bibtex", "-o", outPath)
            ExportFormat.PDF -> listOf(
                props.pandocPath, "-f", htmlReader, "-t", "pdf", "--pdf-engine=${props.typstPath}",
                "-V", "mainfont=${props.pdfFontFamily}", "-o", outPath,
            )
        }
    }

    // ---------------------------------------------------------------- import

    /** Markdown → 编辑器可加载的 HTML（含公式反向映射）。返回 HTML 片段，前端 setContent 后由用户确认保存。 */
    fun importMarkdown(markdown: String): String {
        if (!isImportAvailable()) throw ExportUnavailableException("导入引擎不可用")
        val bytes = markdown.toByteArray(utf8)
        checkSize(bytes.size.toLong())
        val html = withPermit {
            runInTempDir { dir ->
                val out = dir.resolve("out.html")
                // markdown（pandoc 扩展方言）默认支持 $...$ 数学与管道表格；--mathjax 让公式以
                // \(...\) / \[...\] 定界原样输出（否则 html 写出器会把公式渲染成 Unicode，丢失 LaTeX）
                runProcess(
                    listOf(props.pandocPath, "-f", "markdown", "-t", "html5", "--mathjax", "-o", out.toString()),
                    dir,
                    bytes,
                )
                runCatching { Files.readString(out, utf8) }.getOrElse {
                    logger.warn("Import output unreadable: {}", it.javaClass.simpleName)
                    throw ExportFailedException("导入失败，请稍后重试")
                }
            }
        }
        return pandocHtmlToEditor(html)
    }

    // ---------------------------------------------------------------- math transforms (pure, unit-tested)

    /**
     * 把编辑器 KaTeX DOM 里的 [data-latex] 节点规整成 pandoc 可读的 \(...\) / \[...\] 定界公式。
     * 用 JSoup 的 text() 写入，<、>、& 会被转义成实体，pandoc 解码后再交给 tex_math 解析器，
     * 因此 a < b、矩阵里的 & 等都能正确进公式（实测 MathML annotation 反而会被当普通文本转义）。
     */
    fun preprocessMathForPandoc(contentHtml: String): String {
        val doc = Jsoup.parse(contentHtml)
        doc.outputSettings().prettyPrint(false)
        for (el in doc.select("[data-latex]")) {
            val latex = el.attr("data-latex")
            if (latex.isBlank()) continue
            val block = el.attr("data-type").contains("block", ignoreCase = true) || el.tagName().equals("div", true)
            val delimited = if (block) "\\[$latex\\]" else "\\($latex\\)"
            val wrapper = doc.createElement(if (block) "div" else "span")
            wrapper.text(delimited)
            el.replaceWith(wrapper)
        }
        return doc.body().html()
    }

    /** 把 pandoc 输出的 <span class="math"> 反向映射成编辑器的行内/行间公式节点。 */
    fun pandocHtmlToEditor(html: String): String {
        val doc = Jsoup.parse(html)
        doc.outputSettings().prettyPrint(false)
        for (el in doc.select("span.math, div.math")) {
            val display = el.hasClass("display") || el.tagName().equals("div", true)
            val latex = stripMathDelimiters(el.text(), display)
            if (latex.isBlank()) continue
            val node = doc.createElement(if (display) "div" else "span")
            node.attr("data-type", if (display) "block-math" else "inline-math")
            node.attr("data-latex", latex)
            el.replaceWith(node)
        }
        return doc.body().html()
    }

    private fun stripMathDelimiters(raw: String, display: Boolean): String {
        var t = raw.trim()
        if (display) {
            t = t.removePrefix("\\[").removeSuffix("\\]")
        } else {
            t = t.removePrefix("\\(").removeSuffix("\\)")
        }
        return t.trim()
    }

    // ---------------------------------------------------------------- gates & process

    private fun checkSize(bytes: Long) {
        if (bytes > props.maxInputBytes) {
            throw InvalidParameterException("内容过大，超过导出上限（${props.maxInputBytes / 1024} KB）")
        }
    }

    private fun <T> withPermit(block: () -> T): T {
        val acquired = semaphore.tryAcquire(props.acquireTimeoutMs, TimeUnit.MILLISECONDS)
        if (!acquired) throw ExportBusyException()
        try {
            return block()
        } finally {
            semaphore.release()
        }
    }

    private fun <T> runInTempDir(block: (Path) -> T): T {
        val dir = Files.createTempDirectory("pr-export-")
        try {
            return block(dir)
        } finally {
            runCatching { dir.toFile().deleteRecursively() }
                .onFailure { logger.debug("temp dir cleanup failed: {}", it.javaClass.simpleName) }
        }
    }

    private fun runProcess(cmd: List<String>, workDir: Path, stdin: ByteArray) {
        val stderrFile = workDir.resolve("stderr.log").toFile()
        val process = ProcessBuilder(cmd)
            .directory(workDir.toFile())
            .redirectOutput(ProcessBuilder.Redirect.DISCARD)
            .redirectError(stderrFile)
            .start()
        try {
            process.outputStream.use { it.write(stdin) }
            if (!process.waitFor(props.timeoutMs, TimeUnit.MILLISECONDS)) {
                process.destroyForcibly()
                process.waitFor(2, TimeUnit.SECONDS)
                logger.warn("Export engine timed out after {}ms: {}", props.timeoutMs, cmd.firstOrNull())
                throw ExportFailedException("导出超时，请缩减内容后重试")
            }
            val exit = process.exitValue()
            if (exit != 0) {
                logger.warn("Export engine exit={} bin={} stderr(tail)={}", exit, cmd.firstOrNull(), readTail(stderrFile))
                throw ExportFailedException()
            }
        } catch (e: ExportFailedException) {
            throw e
        } catch (e: InterruptedException) {
            process.destroyForcibly()
            Thread.currentThread().interrupt()
            throw ExportFailedException()
        } catch (e: IOException) {
            process.destroyForcibly()
            logger.warn("Export engine IO error: {}", e.javaClass.simpleName)
            throw ExportFailedException()
        }
    }

    private fun readTail(file: File, max: Int = 1500): String =
        runCatching { file.readText(utf8).takeLast(max) }.getOrDefault("")
}
