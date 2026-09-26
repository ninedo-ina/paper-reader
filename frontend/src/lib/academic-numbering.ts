import type { Node as PMNode } from "@tiptap/pm/model"
import type { EditorState, Transaction } from "@tiptap/pm/state"
import { uniqueCslItems, type CslItem } from "@/lib/citations"

export const FOOTNOTE_REFERENCE_NODE = "footnoteReference"
export const FOOTNOTE_LIST_NODE = "footnoteList"
export const BIBLIOGRAPHY_NODE = "bibliography"
export const CITATION_NODE = "citation"
export const CROSS_REFERENCE_NODE = "crossReference"

export type NumberedTargetKind = "formula" | "table" | "figure"

/** 交叉引用能指向的节点类型。图片节点由 v0.1.53 引入，这里先把编号能力铺好。 */
const NUMBERED_TARGET_NODES: Record<string, NumberedTargetKind> = {
  blockMath: "formula",
  table: "table",
  image: "figure",
}

export const NUMBERED_TARGET_KINDS: NumberedTargetKind[] = ["formula", "table", "figure"]

/** 落进文末脚注表属性的形态：位置会随编辑漂移，不进属性。 */
export interface FootnoteEntry {
  id: string
  note: string
  number: number
}

/** 扫描结果的形态，多带一个文档位置，供文末表格反查引用节点用。 */
export interface FootnoteRef extends FootnoteEntry {
  pos: number
}

export interface NumberedTarget {
  id: string
  kind: NumberedTargetKind
  number: number
  pos: number
}

/**
 * 脚注正文写在引用节点的 note 属性上（单一数据源），文末列表与编号都由文档顺序推导。
 * 这样"在正文中间插一条脚注"不需要同步第二份数据，编号天然正确。
 * 同一条脚注被引用两次时按首次出现计数，编号不重复。
 */
export function collectFootnotes(doc: PMNode): FootnoteRef[] {
  const entries = new Map<string, FootnoteRef>()
  doc.descendants((node, pos) => {
    if (node.type.name !== FOOTNOTE_REFERENCE_NODE) return true
    const id = String(node.attrs.id ?? "")
    if (!id || entries.has(id)) return true
    entries.set(id, { id, note: String(node.attrs.note ?? ""), number: entries.size + 1, pos })
    return true
  })
  return [...entries.values()]
}

export function footnotePosition(doc: PMNode, id: string): number | null {
  return collectFootnotes(doc).find((entry) => entry.id === id)?.pos ?? null
}

/** 只取第一个参考文献表：一篇论文一个文献表，多个表会让编号无解。 */
export function collectBibliography(doc: PMNode): CslItem[] {
  let entries: CslItem[] = []
  doc.descendants((node) => {
    if (node.type.name !== BIBLIOGRAPHY_NODE) return true
    const raw = node.attrs.entries
    if (Array.isArray(raw)) entries = raw as CslItem[]
    return false
  })
  return entries
}

function collectCitedIds(doc: PMNode): string[] {
  const ids: string[] = []
  doc.descendants((node) => {
    if (node.type.name !== CITATION_NODE) return true
    const id = String(node.attrs.refId ?? "")
    if (id && !ids.includes(id)) ids.push(id)
    return true
  })
  return ids
}

/**
 * 引用编号 = 在参考文献表里的位次。
 *
 * 这是"真引用系统"与"手打编号"的分界线：编号不落库、不手改，只由文献表顺序推导，
 * 因此在文献表里上移/下移一条，正文里所有引用标记的编号会一起重排。
 * 表里没有的引用（用户删了条目但正文还留着标记）排在表后继续编号，不会退化成问号。
 */
export function collectCitationNumbers(doc: PMNode): Map<string, number> {
  const numbers = new Map<string, number>()
  uniqueCslItems(collectBibliography(doc)).forEach((entry, index) => {
    numbers.set(entry.id, index + 1)
  })
  for (const id of collectCitedIds(doc)) {
    if (!numbers.has(id)) numbers.set(id, numbers.size + 1)
  }
  return numbers
}

/** 公式/表/图各自独立计数，按文档出现顺序。没有唯一 ID 的节点不参与编号。 */
export function collectNumberedTargets(doc: PMNode): NumberedTarget[] {
  const counters: Record<NumberedTargetKind, number> = { formula: 0, table: 0, figure: 0 }
  const targets: NumberedTarget[] = []
  doc.descendants((node, pos) => {
    const kind = NUMBERED_TARGET_NODES[node.type.name]
    if (!kind) return true
    const id = String(node.attrs.id ?? "")
    if (!id) return true
    counters[kind] += 1
    targets.push({ id, kind, number: counters[kind], pos })
    return true
  })
  return targets
}

export function targetNumbers(doc: PMNode): Map<string, NumberedTarget> {
  return new Map(collectNumberedTargets(doc).map((target) => [target.id, target]))
}

interface NodeAttrUpdate {
  pos: number
  attrs: Record<string, unknown>
}

function sameFootnotes(raw: unknown, next: FootnoteEntry[]): boolean {
  if (!Array.isArray(raw) || raw.length !== next.length) return false
  return next.every((entry, index) => {
    const current = raw[index] as FootnoteEntry | undefined
    return (
      current?.id === entry.id &&
      String(current?.note ?? "") === entry.note &&
      Number(current?.number ?? 0) === entry.number
    )
  })
}

function collectDerivedUpdates(doc: PMNode): NodeAttrUpdate[] {
  const footnotes = collectFootnotes(doc)
  const footnoteNumbers = new Map(footnotes.map((entry) => [entry.id, entry.number]))
  const citations = collectCitationNumbers(doc)
  const targets = targetNumbers(doc)
  const updates: NodeAttrUpdate[] = []

  const setNumber = (node: PMNode, pos: number, next: number | null) => {
    if (Number(node.attrs.number ?? 0) === Number(next ?? 0)) return
    updates.push({ pos, attrs: { ...node.attrs, number: next } })
  }

  doc.descendants((node, pos) => {
    switch (node.type.name) {
      case FOOTNOTE_REFERENCE_NODE:
        setNumber(node, pos, footnoteNumbers.get(String(node.attrs.id ?? "")) ?? null)
        return true
      case CITATION_NODE:
        setNumber(node, pos, citations.get(String(node.attrs.refId ?? "")) ?? null)
        return true
      case CROSS_REFERENCE_NODE: {
        const target = targets.get(String(node.attrs.targetId ?? ""))
        setNumber(node, pos, target ? target.number : null)
        return true
      }
      case FOOTNOTE_LIST_NODE: {
        const entries = footnotes.map(({ id, note, number }) => ({ id, note, number }))
        if (!sameFootnotes(node.attrs.entries, entries)) {
          updates.push({ pos, attrs: { ...node.attrs, entries } })
        }
        return true
      }
      default:
        return true
    }
  })

  return updates
}

/**
 * 编号是派生的，不能只活在 NodeView 里 —— 否则 `editor.getHTML()` 与导出拿到的是过时编号。
 * 所有派生数据都回写到节点属性上（只改 attrs、不改结构，位置不会漂移），
 * 编辑器显示、复制粘贴、导出三条路径读到的就是同一份数字与同一份脚注正文。
 *
 * 幂等：第二次跑不会产生新的更新，appendTransaction 因此不会自激成死循环。
 */
export function numberingTransaction(state: EditorState): Transaction | null {
  const updates = collectDerivedUpdates(state.doc)
  if (!updates.length) return null

  const tr = state.tr
  for (const update of updates) {
    const node = tr.doc.nodeAt(update.pos)
    if (!node) continue
    tr.setNodeMarkup(update.pos, undefined, update.attrs)
  }
  return tr
}
