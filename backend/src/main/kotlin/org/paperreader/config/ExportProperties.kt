package org.paperreader.config

import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.stereotype.Component

/**
 * 导出/导入引擎配置 / Export & import engine settings（前缀 app.export）。
 *
 * 引擎（pandoc / typst）以独立进程在服务端执行，是可被用户触发的资源面。这里集中管理
 * 五道闸门相关的参数：超时、并发上限、输入大小上限、临时/产物目录、二进制路径。
 * 用可变 var + 默认值（setter 绑定），因此无需 @ConfigurationPropertiesScan，随组件扫描注入。
 */
@Component
@ConfigurationProperties(prefix = "app.export")
class ExportProperties {
    /** pandoc 可执行文件路径。PM2 环境 PATH 可能不含 /usr/bin 以外目录，默认给绝对路径。 */
    var pandocPath: String = "/usr/bin/pandoc"

    /** typst 可执行文件路径（PDF 导出经 pandoc --pdf-engine=typst 调用）。 */
    var typstPath: String = "/usr/local/bin/typst"

    /** 单个引擎进程的墙钟超时（毫秒）。超时即 destroyForcibly。 */
    var timeoutMs: Long = 30_000

    /** 全局并发导出上限（信号量许可数）。 */
    var maxConcurrency: Int = 3

    /** 等待并发许可的最长时间（毫秒）；超过即返回 429（ExportBusyException）。 */
    var acquireTimeoutMs: Long = 2_000

    /** 允许导出的正文 HTML 字节上限；超过即 400，拒绝在引擎前。 */
    var maxInputBytes: Long = 2_000_000

    /** 导出产物落盘根目录（相对工作目录或绝对路径）。 */
    var outputDir: String = "./uploads/exports"

    /** PDF（typst）正文字体，需为服务端已装、含 CJK 的字体。 */
    var pdfFontFamily: String = "Noto Serif CJK SC"
}
