import { describe, expect, it } from "vitest"
import type { JSONContent } from "@tiptap/react"
import {
  collapseUnchanged,
  diffContent,
  diffLines,
  extractPlainText,
  toLines,
} from "@/components/papers/PaperEditor/content-diff"

function doc(...blocks: JSONContent[]): JSONContent {
  return { type: "doc", content: blocks }
}

function p(text: string): JSONContent {
  return { type: "paragraph", content: [{ type: "text", text }] }
}

function heading(text: string): JSONContent {
  return { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text }] }
}

describe("正文快照对比：节点树拍平成纯文本", () => {
  it("把块级兄弟节点拆成不同的行", () => {
    expect(extractPlainText(doc(p("第一段"), p("第二段")))).toBe("第一段\n第二段")
    expect(extractPlainText(doc(heading("标题"), p("正文")))).toBe("标题\n正文")
  })

  it("一段里的软换行也换行，但不会多出一整行", () => {
    const withBreak: JSONContent = {
      type: "paragraph",
      content: [
        { type: "text", text: "前半" },
        { type: "hardBreak" },
        { type: "text", text: "后半" },
      ],
    }

    expect(extractPlainText(doc(withBreak))).toBe("前半\n后半")
  })

  it("空正文拍成空串，null 也不炸", () => {
    expect(extractPlainText(null)).toBe("")
    expect(extractPlainText(undefined)).toBe("")
    expect(extractPlainText(doc())).toBe("")
  })

  it("按行切分时保留空行，因为它们就是段落之间的分隔", () => {
    expect(toLines("a\n\nb")).toEqual(["a", "", "b"])
  })
})

describe("正文快照对比：逐行差异", () => {
  it("两边一样时没有增删", () => {
    const result = diffContent(doc(p("标题"), p("正文")), doc(p("标题"), p("正文")))

    expect(result.added).toBe(0)
    expect(result.removed).toBe(0)
    expect(result.lines.every((line) => line.kind === "same")).toBe(true)
  })

  it("改掉中间一段时只标出这一段，前后不动", () => {
    const result = diffContent(doc(p("开头"), p("旧说法"), p("结尾")), doc(p("开头"), p("新说法"), p("结尾")))

    expect(result.removed).toBe(1)
    expect(result.added).toBe(1)
    // 公共前后缀不会因为中间改动而抖动
    expect(result.lines[0]).toEqual({ kind: "same", text: "开头" })
    expect(result.lines.at(-1)).toEqual({ kind: "same", text: "结尾" })
  })

  it("只在末尾追加内容时，前面全部算未改动", () => {
    const result = diffContent(doc(p("A"), p("B")), doc(p("A"), p("B"), p("C")))

    expect(result.added).toBe(1)
    expect(result.removed).toBe(0)
    expect(result.lines.filter((line) => line.kind === "added").map((line) => line.text)).toEqual(["C"])
  })

  it("删掉中间一段时报成删除而不是「整篇重写」", () => {
    const result = diffContent(doc(p("A"), p("B"), p("C")), doc(p("A"), p("C")))

    expect(result.removed).toBe(1)
    expect(result.added).toBe(0)
    expect(result.lines.filter((line) => line.kind === "removed").map((line) => line.text)).toEqual(["B"])
  })

  it("正文长到超出 DP 上限时退化成整段替换，并标记 coarse", () => {
    // 两侧各 2000 行、且没有一行相同，乘积远超 1_000_000 的上限
    const before = Array.from({ length: 2000 }, (_, i) => `旧 ${i}`)
    const after = Array.from({ length: 2000 }, (_, i) => `新 ${i}`)

    const result = diffLines(before, after)

    expect(result.coarse).toBe(true)
    expect(result.lines.filter((line) => line.kind === "removed")).toHaveLength(2000)
    expect(result.lines.filter((line) => line.kind === "added")).toHaveLength(2000)
  })

  it("正常规模的两篇正文不会退化成 coarse", () => {
    const before = Array.from({ length: 50 }, (_, i) => `段 ${i}`)
    const after = [...before]
    after[25] = "改过的段"

    const result = diffLines(before, after)

    expect(result.coarse).toBe(false)
    expect(result.lines.filter((line) => line.kind === "added")).toHaveLength(1)
  })
})

describe("正文快照对比：折叠未改动的长段落", () => {
  it("保留改动处的上下文，把远处的相同行折成一行", () => {
    const before = Array.from({ length: 40 }, (_, i) => `段 ${i}`)
    const after = [...before]
    after[20] = "改过的段"

    const collapsed = collapseUnchanged(diffLines(before, after).lines, 3)

    expect(collapsed.length).toBeLessThan(20)
    // 改动那一行本身还在
    expect(collapsed.some((line) => line.kind === "added" && line.text === "改过的段")).toBe(true)
    // 被省掉的行汇总成折叠标记，而不是凭空消失：改动处上下各留 3 行上下文
    const collapsedTotal = collapsed.reduce((sum, line) => sum + (line.collapsedCount ?? 0), 0)
    const keptSame = collapsed.filter((line) => line.kind === "same" && line.collapsedCount == null).length
    const sameCount = diffLines(before, after).lines.filter((line) => line.kind === "same").length
    expect(keptSame).toBe(6)
    expect(collapsedTotal).toBe(sameCount - keptSame)
  })

  it("没有任何改动时整篇折成一行", () => {
    const lines = Array.from({ length: 30 }, (_, i) => ({ kind: "same" as const, text: `段 ${i}` }))

    expect(collapseUnchanged(lines, 3)).toEqual([{ kind: "same", text: "", collapsedCount: 30 }])
  })

  it("首尾都没有改动、改动在正中间时，折叠标记分别落在两端", () => {
    const before = ["A", "B", "C", "D", "E", "F", "G"]
    const after = ["A", "B", "C", "变了", "E", "F", "G"]

    const collapsed = collapseUnchanged(diffLines(before, after).lines, 1)

    expect(collapsed[0]).toEqual({ kind: "same", text: "", collapsedCount: 2 })
    expect(collapsed.at(-1)).toEqual({ kind: "same", text: "", collapsedCount: 2 })
  })
})
