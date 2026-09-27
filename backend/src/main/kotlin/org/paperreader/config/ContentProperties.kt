package org.paperreader.config

import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.stereotype.Component

/**
 * 正文（W1 编辑器）读写的体积闸门与快照保留策略 / Content size gates & retention（前缀 app.content）。
 *
 * 正文是 `pr_papers` 上最大的一列，也是唯一一条"用户每敲几下键盘就整体覆盖一次"的高频写路径。
 * 不给上限的话，一次粘贴进来的大文档就能把这行撑到几十 MB：每次自动保存整行重写 + 写 WAL，
 * 读一次还要把整串解析成 JsonNode；副本、备份、`ddl-auto=validate` 之外的迁移都会跟着受影响。
 * 所以这里把"单篇正文多大"定成配置，而不是留在代码里散落判断。
 *
 * 三道闸门，由小到大：
 *  1. [maxJsonBytes]     —— 权威节点树（contentJson）的写闸门，超限 1014/413；
 *  2. [maxHtmlBytes]     —— 同一篇派生的 contentHtml 的写闸门。HTML 带标签和内联样式，
 *                          天然比节点树长数倍，故给 2 倍余量；
 *  3. [maxReadableBytes] —— 读取硬上限。正常写作永远碰不到；它给闸门上线之前写进来的
 *                          历史大正文兜底（也用于请求体预检），避免一次 GET/PUT 把整串读进内存。
 *                          介于写闸门与读闸门之间的老正文仍读得出来——用户得能打开它、自己删减，
 *                          只是不能再往大里写。
 *
 * 快照保留策略（[maxSnapshotCount] / [maxSnapshotAgeDays]）随 `/api/papers/content-limits`
 * 下发给客户端，并由 `PaperContentVersionService.pruneSnapshots` 在每次写入快照后执行淘汰：
 * 超龄的未打标签快照先删，仍超份数再按「未打标签优先、旧的优先」删到上限以内。
 * 新写入的快照与刚回滚到的目标快照始终保留。快照里装的是整篇正文，没有这两个上限，
 * 「历史」就是无界的（一篇 2MB 的论文留 200 份就是 400MB）。
 */
@Component
@ConfigurationProperties(prefix = "app.content")
class ContentProperties {
    /** 单篇 contentJson（UTF-8 字节）写入上限。约 2MB ≈ 40 万字中文正文。 */
    var maxJsonBytes: Long = 2_000_000

    /** 单篇 contentHtml（UTF-8 字节）写入上限。 */
    var maxHtmlBytes: Long = 4_000_000

    /** 单篇正文的读取/请求体硬上限，只用于兜底与预检。 */
    var maxReadableBytes: Long = 16_000_000

    /** 单篇论文保留的历史快照份数上限（写入快照后按此淘汰，硬上限）。 */
    var maxSnapshotCount: Int = 20

    /** 未打标签的历史快照最长保留天数（标签快照不因时间被删）。 */
    var maxSnapshotAgeDays: Int = 90
}
