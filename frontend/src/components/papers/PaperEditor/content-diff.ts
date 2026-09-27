import type { JSONContent } from "@tiptap/react"

export type DiffKind = "same" | "added" | "removed"

export interface DiffLine {
  kind: DiffKind
  text: string
  /**
   * 折叠标记：仅 kind==="same" 时可能出现。非空表示这里省略了这么多行未改动的正文，
   * 渲染成一行「⋯ 折叠 N 行」而不是把整篇相同的正文铺满屏幕。
   */
  collapsedCount?: number
}

export interface ContentDiff {
  lines: DiffLine[]
  added: number
  removed: number
  /** 超过规模上限退化成「整段替换」时为 true；此时 diff 仍正确，只是不够细。 */
  coarse: boolean
}

/**
 * 块级节点：两个块之间换行，块内部的兄弟节点直接相接。
 * 不这样区分的话，`<p>a</p><p>b</p>` 会被拼成 "ab"，而一段里的 `a<br>b` 会被拼成 "a\n\nb"。
 */
const BLOCK_TYPES = new Set([
  "doc",
  "paragraph",
  "heading",
  "blockquote",
  "codeBlock",
  "bulletList",
  "orderedList",
  "listItem",
  "table",
  "tableRow",
  "tableHeader",
  "tableCell",
  "horizontalRule",
])

function isBlock(node: JSONContent): boolean {
  return node.type != null && BLOCK_TYPES.has(node.type)
}

function collectText(node: JSONContent, out: string[]) {
  if (typeof node.text === "string") {
    out.push(node.text)
    return
  }
  if (node.type === "hardBreak") {
    out.push("\n")
    return
  }
  const children = node.content ?? []
  children.forEach((child, index) => {
    if (index > 0 && isBlock(child)) out.push("\n")
    collectText(child, out)
  })
}

/**
 * 把编辑器节点树拍平成纯文本，供对比用。
 *
 * 对比只在纯文本上做，不比对 JSON 结构：同一段话只因为多了个加粗标记就报「整段不同」，
 * 对写作者没有意义。代价是格式改动（加粗、字号）在 diff 里看不出来，这是刻意的取舍。
 */
export function extractPlainText(content: JSONContent | null | undefined): string {
  if (!content) return ""
  const out: string[] = []
  collectText(content, out)
  return out.join("")
}

export function toLines(text: string): string[] {
  return text.split(/\r?\n/)
}

/** 中间段太长的兜底阈值（行数乘积）：LCS 的 DP 表是 O(n·m)，不能对整篇大论文无脑铺。 */
const MAX_DP_CELLS = 1_000_000

function lcsDiff(before: string[], after: string[], coarse: { value: boolean }): DiffLine[] {
  const n = before.length
  const m = after.length

  if ((n + 1) * (m + 1) > MAX_DP_CELLS) {
    // 退化成整段替换：宁可粗一点，也不能让一次对比把主线程算到卡死。
    coarse.value = true
    return [
      ...before.map((text): DiffLine => ({ kind: "removed", text })),
      ...after.map((text): DiffLine => ({ kind: "added", text })),
    ]
  }

  // dp[i][j] = a[i..] 与 b[j..] 的最长公共子序列长度，用一维数组滚动省内存。
  const width = m + 1
  const dp = new Int32Array((n + 1) * width)
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * width + j] =
        before[i] === after[j]
          ? dp[(i + 1) * width + (j + 1)] + 1
          : Math.max(dp[(i + 1) * width + j], dp[i * width + (j + 1)])
    }
  }

  const lines: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      lines.push({ kind: "same", text: before[i] })
      i++
      j++
    } else if (dp[(i + 1) * width + j] >= dp[i * width + (j + 1)]) {
      lines.push({ kind: "removed", text: before[i] })
      i++
    } else {
      lines.push({ kind: "added", text: after[j] })
      j++
    }
  }
  while (i < n) lines.push({ kind: "removed", text: before[i++] })
  while (j < m) lines.push({ kind: "added", text: after[j++] })
  return lines
}

/**
 * 逐行对比。
 *
 * 先削掉公共前后缀再对中间段做 LCS：改动通常只集中在一两段，削掉前后缀后中间段很短，
 * 既快，结果也不会因为「先删后加还是先加后删」而在无关段落上抖动。
 */
export function diffLines(before: string[], after: string[]): { lines: DiffLine[]; coarse: boolean } {
  let start = 0
  while (start < before.length && start < after.length && before[start] === after[start]) start++
  let endBefore = before.length
  let endAfter = after.length
  while (endBefore > start && endAfter > start && before[endBefore - 1] === after[endAfter - 1]) {
    endBefore--
    endAfter--
  }

  const coarse = { value: false }
  const lines = [
    ...before.slice(0, start).map((text): DiffLine => ({ kind: "same", text })),
    ...lcsDiff(before.slice(start, endBefore), after.slice(start, endAfter), coarse),
    ...before.slice(endBefore).map((text): DiffLine => ({ kind: "same", text })),
  ]
  return { lines, coarse: coarse.value }
}

/**
 * 两篇正文的差异。任一侧可以是「当前正文」（由调用方先取服务端的正文再传进来）。
 */
export function diffContent(
  before: JSONContent | null | undefined,
  after: JSONContent | null | undefined,
): ContentDiff {
  const { lines, coarse } = diffLines(
    toLines(extractPlainText(before)),
    toLines(extractPlainText(after)),
  )
  let added = 0
  let removed = 0
  for (const line of lines) {
    if (line.kind === "added") added++
    else if (line.kind === "removed") removed++
  }
  return { lines, added, removed, coarse }
}

/**
 * 折叠未改动的长段落，只保留改动前后的 context 行。
 * 返回的行数远少于原始 diff，但改动处的上下文仍然完整。
 */
export function collapseUnchanged(lines: DiffLine[], context = 3): DiffLine[] {
  const keep = new Set<number>()
  lines.forEach((line, index) => {
    if (line.kind === "same") return
    for (let i = index - context; i <= index + context; i++) {
      if (i >= 0 && i < lines.length) keep.add(i)
    }
  })

  const out: DiffLine[] = []
  let skipped = 0
  lines.forEach((line, index) => {
    if (keep.has(index)) {
      if (skipped > 0) {
        out.push({ kind: "same", text: "", collapsedCount: skipped })
        skipped = 0
      }
      out.push(line)
    } else {
      skipped++
    }
  })
  if (skipped > 0) out.push({ kind: "same", text: "", collapsedCount: skipped })
  return out
}
