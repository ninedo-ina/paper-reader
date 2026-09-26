"use client"

import type { Node as PMNode } from "@tiptap/pm/model"
import {
  mergeAttributes,
  Node,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from "@tiptap/react"
import { useTranslations } from "next-intl"
import { Trash2 } from "lucide-react"
import {
  collectFootnotes,
  FOOTNOTE_LIST_NODE,
  FOOTNOTE_REFERENCE_NODE,
  footnotePosition,
  type FootnoteEntry,
} from "@/lib/academic-numbering"
import { revealAnnotation } from "./scroll"

/**
 * 脚注正文只存在引用节点的 note 属性上，文末列表的 entries 由编号插件按文档顺序推导后回写。
 * 反过来（正文引用只存 id、正文写在列表里）会多出一份需要人工同步的数据，
 * 在正文中间插入一条脚注时列表顺序与编号就会错位。
 */
const footnoteAttributes = {
  id: {
    default: null,
    parseHTML: (element: HTMLElement) => element.getAttribute("data-footnote-id"),
    renderHTML: (attributes: Record<string, unknown>) =>
      attributes.id ? { "data-footnote-id": attributes.id } : {},
  },
  note: {
    default: "",
    parseHTML: (element: HTMLElement) => element.getAttribute("data-footnote-note") ?? "",
    renderHTML: (attributes: Record<string, unknown>) => ({
      "data-footnote-note": String(attributes.note ?? ""),
    }),
  },
  number: {
    default: null,
    parseHTML: (element: HTMLElement) => {
      const raw = element.getAttribute("data-footnote-number")
      if (raw == null) return null
      const value = Number.parseInt(raw, 10)
      return Number.isFinite(value) ? value : null
    },
    renderHTML: (attributes: Record<string, unknown>) =>
      attributes.number == null ? {} : { "data-footnote-number": String(attributes.number) },
  },
}

function FootnoteReferenceView({ editor, node }: ReactNodeViewProps) {
  const t = useTranslations("papers")
  const id = String(node.attrs.id ?? "")
  const note = String(node.attrs.note ?? "")
  const number = node.attrs.number

  return (
    <NodeViewWrapper
      as="sup"
      className="academic-footnote-ref"
      data-footnote-id={id}
      contentEditable={false}
    >
      <button
        type="button"
        className="academic-footnote-marker"
        title={note || t("footnoteEmpty")}
        aria-label={t("footnoteLabel")}
        onClick={() => revealAnnotation(editor, "data-footnote-entry", id)}
      >
        {number == null ? "?" : number}
      </button>
    </NodeViewWrapper>
  )
}

export const FootnoteReference = Node.create({
  name: FOOTNOTE_REFERENCE_NODE,
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return footnoteAttributes
  },

  parseHTML() {
    return [{ tag: "sup[data-footnote-id]" }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const number = node.attrs.number
    return [
      "sup",
      mergeAttributes(HTMLAttributes, { class: "academic-footnote-ref" }),
      `[${number == null ? "?" : number}]`,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(FootnoteReferenceView)
  },
})

function FootnoteListView({ editor, node }: ReactNodeViewProps) {
  const t = useTranslations("papers")
  const entries = (Array.isArray(node.attrs.entries) ? node.attrs.entries : []) as FootnoteEntry[]

  const commit = (id: string, value: string) => updateFootnoteNote(editor, id, value)

  return (
    <NodeViewWrapper
      as="section"
      className="academic-endnote-block"
      data-footnote-list=""
      contentEditable={false}
    >
      <h3 className="academic-section-title">{t("footnoteListTitle")}</h3>
      {entries.length === 0 ? (
        <p className="academic-empty">{t("footnoteEmpty")}</p>
      ) : (
        <ol className="academic-footnote-list">
          {entries.map((entry) => (
            <li key={entry.id} data-footnote-entry={entry.id} className="academic-footnote-entry">
              <span className="academic-entry-number">{entry.number}</span>
              <textarea
                className="academic-note-input"
                rows={2}
                defaultValue={entry.note}
                placeholder={t("footnotePlaceholder")}
                onBlur={(event) => commit(entry.id, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.shiftKey) return
                  event.preventDefault()
                  commit(entry.id, event.currentTarget.value)
                  event.currentTarget.blur()
                }}
              />
              <button
                type="button"
                className="academic-icon-button"
                title={t("footnoteRemove")}
                aria-label={t("footnoteRemove")}
                onClick={() => removeFootnote(editor, entry.id)}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ol>
      )}
    </NodeViewWrapper>
  )
}

export const FootnoteList = Node.create({
  name: FOOTNOTE_LIST_NODE,
  group: "block",
  atom: true,
  selectable: true,

  addOptions() {
    return { title: "" }
  },

  addAttributes() {
    return {
      entries: { default: [] as FootnoteEntry[] },
    }
  },

  parseHTML() {
    return [{ tag: "section[data-footnote-list]" }]
  },

  /**
   * 导出用的 HTML 自己把条目渲染出来：文末脚注在论文里必须看得见，
   * 只留一个空属性的话导出结果里脚注正文就丢了。
   * 标题走扩展选项而不是节点属性：它是界面文案，不该跟着正文一起被复制粘贴到别的语言环境里。
   */
  renderHTML({ node, HTMLAttributes }) {
    const entries = (Array.isArray(node.attrs.entries) ? node.attrs.entries : []) as FootnoteEntry[]
    const items = entries.map((entry) => [
      "li",
      { "data-footnote-entry": entry.id, class: "academic-footnote-entry" },
      `${entry.number}. ${entry.note}`,
    ])
    const children: unknown[] = [
      ["ol", { class: "academic-footnote-list" }, ...items],
    ]
    if (this.options.title) {
      children.unshift(["h3", { class: "academic-section-title" }, this.options.title])
    }
    return [
      "section",
      mergeAttributes(HTMLAttributes, { "data-footnote-list": "", class: "academic-endnote-block" }),
      ...children,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(FootnoteListView)
  },
})

function footnoteListPosition(doc: PMNode): number | null {
  let position: number | null = null
  doc.descendants((node, pos) => {
    if (node.type.name !== FOOTNOTE_LIST_NODE) return true
    position = pos
    return false
  })
  return position
}

let footnoteSequence = 0

/** 用 base36 时间 + 自增序号，字符集只含 [0-9a-z-]，当成 HTML 属性值到处传都不用转义。 */
export function createFootnoteId(): string {
  footnoteSequence += 1
  return `fn-${Date.now().toString(36)}-${footnoteSequence.toString(36)}`
}

/**
 * 第一条脚注插入时才建文末列表。
 * updateSelection: false 是关键：否则在文末插入列表会把光标抢走，
 * 紧接着的正文引用就插到了文档末尾，而不是用户当前的位置。
 */
export function ensureFootnoteList(editor: ReactNodeViewProps["editor"]): void {
  if (footnoteListPosition(editor.state.doc) != null) return
  editor
    .chain()
    .insertContentAt(editor.state.doc.content.size, { type: FOOTNOTE_LIST_NODE }, { updateSelection: false })
    .run()
}

export function insertFootnote(editor: ReactNodeViewProps["editor"], note: string): void {
  ensureFootnoteList(editor)
  editor
    .chain()
    .focus()
    .insertContent({ type: FOOTNOTE_REFERENCE_NODE, attrs: { id: createFootnoteId(), note, number: null } })
    .run()
}

/** 改的是引用节点上的 note，列表里的那条由编号插件在同一个事务周期里跟着更新。 */
export function updateFootnoteNote(
  editor: ReactNodeViewProps["editor"],
  id: string,
  note: string,
): void {
  const pos = footnotePosition(editor.state.doc, id)
  if (pos == null) return
  const node = editor.state.doc.nodeAt(pos)
  if (!node || String(node.attrs.note ?? "") === note) return
  editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, note }))
}

/**
 * 删脚注等于删掉正文里的引用标记，文末条目自然跟着消失（Word 也是这个模型）。
 * 最后一条被删掉时空的列表节点一起清掉，免得导出结果里挂一个没有内容的「脚注」小节。
 */
export function removeFootnote(editor: ReactNodeViewProps["editor"], id: string): void {
  const pos = footnotePosition(editor.state.doc, id)
  if (pos == null) return
  const node = editor.state.doc.nodeAt(pos)
  if (!node) return

  const tr = editor.state.tr.delete(pos, pos + node.nodeSize)
  if (collectFootnotes(tr.doc).length === 0) {
    const listPos = footnoteListPosition(tr.doc)
    if (listPos != null) {
      const listNode = tr.doc.nodeAt(listPos)
      if (listNode) tr.delete(listPos, listPos + listNode.nodeSize)
    }
  }
  editor.view.dispatch(tr)
}
