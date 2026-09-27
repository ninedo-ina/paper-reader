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
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react"
import {
  formatBibliographyEntry,
  referenceUrl,
  uniqueCslItems,
  type CslItem,
} from "@/lib/citations"
import { BIBLIOGRAPHY_NODE, CITATION_NODE } from "@/lib/academic-numbering"
import { revealAnnotation } from "./scroll"

/**
 * 正文里的引用标记。只存 refId，编号由参考文献表里的位次推导 ——
 * 手打编号的文档在调整文献顺序后必须逐条改，这里改完顺序正文自动重排。
 */
export const Citation = Node.create({
  name: CITATION_NODE,
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      refId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-citation-ref"),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.refId ? { "data-citation-ref": attributes.refId } : {},
      },
      number: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const raw = element.getAttribute("data-citation-number")
          if (raw == null) return null
          const value = Number.parseInt(raw, 10)
          return Number.isFinite(value) ? value : null
        },
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.number == null ? {} : { "data-citation-number": String(attributes.number) },
      },
    }
  },

  parseHTML() {
    return [{ tag: "span[data-citation-ref]" }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const number = node.attrs.number
    return [
      "span",
      mergeAttributes(HTMLAttributes, { class: "academic-citation" }),
      `[${number == null ? "?" : number}]`,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CitationView)
  },
})

function CitationView({ editor, node }: ReactNodeViewProps) {
  const t = useTranslations("papers")
  const refId = String(node.attrs.refId ?? "")
  const number = node.attrs.number

  return (
    <NodeViewWrapper
      as="span"
      className="academic-citation"
      data-citation-ref={refId}
      contentEditable={false}
    >
      <button
        type="button"
        className="academic-citation-marker"
        title={t("citationPickerTitle")}
        aria-label={t("citationPickerTitle")}
        onClick={() => revealAnnotation(editor, "data-csl-id", refId)}
      >
        {number == null ? "?" : `[${number}]`}
      </button>
    </NodeViewWrapper>
  )
}

export const Bibliography = Node.create({
  name: BIBLIOGRAPHY_NODE,
  group: "block",
  atom: true,
  selectable: true,

  addOptions() {
    return { locale: "en", title: "" }
  },

  addAttributes() {
    return {
      entries: { default: [] as CslItem[] },
    }
  },

  parseHTML() {
    return [{ tag: "section[data-bibliography]" }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const entries = (Array.isArray(node.attrs.entries) ? node.attrs.entries : []) as CslItem[]
    const items = entries.map((entry) => [
      "li",
      { "data-csl-id": entry.id, class: "academic-reference-entry" },
      formatBibliographyEntry(entry, this.options.locale),
    ])
    const children: unknown[] = [["ol", { class: "academic-reference-list" }, ...items]]
    if (this.options.title) {
      children.unshift(["h3", { class: "academic-section-title" }, this.options.title])
    }
    return [
      "section",
      mergeAttributes(HTMLAttributes, { "data-bibliography": "", class: "academic-endnote-block" }),
      ...children,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(BibliographyView)
  },
})

function BibliographyView({ node, updateAttributes, extension }: ReactNodeViewProps) {
  const t = useTranslations("papers")
  const entries = (Array.isArray(node.attrs.entries) ? node.attrs.entries : []) as CslItem[]
  const locale = String(extension.options.locale ?? "en")

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= entries.length) return
    const next = [...entries]
    ;[next[index], next[target]] = [next[target], next[index]]
    updateAttributes({ entries: next })
  }

  const remove = (index: number) => {
    updateAttributes({ entries: entries.filter((_, position) => position !== index) })
  }

  return (
    <NodeViewWrapper
      as="section"
      className="academic-endnote-block"
      data-bibliography=""
      contentEditable={false}
    >
      <h3 className="academic-section-title">{t("bibliographyTitle")}</h3>
      {entries.length === 0 ? (
        <p className="academic-empty">{t("bibliographyEmpty")}</p>
      ) : (
        <ol className="academic-reference-list">
          {entries.map((entry, index) => {
            const url = referenceUrl(entry)
            return (
              <li key={entry.id} data-csl-id={entry.id} className="academic-reference-entry">
                <span className="academic-entry-number">{index + 1}</span>
                <span className="academic-reference-text">
                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer noopener" className="academic-reference-link">
                      {formatBibliographyEntry(entry, locale)}
                    </a>
                  ) : (
                    formatBibliographyEntry(entry, locale)
                  )}
                </span>
                <span className="academic-entry-actions">
                  <button
                    type="button"
                    className="academic-icon-button"
                    title={t("bibliographyMoveUp")}
                    aria-label={t("bibliographyMoveUp")}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    className="academic-icon-button"
                    title={t("bibliographyMoveDown")}
                    aria-label={t("bibliographyMoveDown")}
                    disabled={index === entries.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    className="academic-icon-button"
                    title={t("bibliographyRemove")}
                    aria-label={t("bibliographyRemove")}
                    onClick={() => remove(index)}
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </NodeViewWrapper>
  )
}

function bibliographyPosition(doc: PMNode): number | null {
  let position: number | null = null
  doc.descendants((node, pos) => {
    if (node.type.name !== BIBLIOGRAPHY_NODE) return true
    position = pos
    return false
  })
  return position
}

/**
 * 把一条文献写进参考文献表，没有表就先建一个并放到文末。
 * 表存在时是原地改属性，不动文档结构 —— 正文里的引用标记位置不会漂移。
 */
export function upsertBibliographyEntry(editor: ReactNodeViewProps["editor"], item: CslItem): void {
  const state = editor.state
  const pos = bibliographyPosition(state.doc)

  if (pos == null) {
    const type = state.schema.nodes[BIBLIOGRAPHY_NODE]
    if (!type) return
    const node = type.create({ entries: uniqueCslItems([item]) })
    editor.view.dispatch(state.tr.insert(state.doc.content.size, node).scrollIntoView())
    return
  }

  const node = state.doc.nodeAt(pos)
  if (!node) return
  const entries = (Array.isArray(node.attrs.entries) ? node.attrs.entries : []) as CslItem[]
  const next = uniqueCslItems([...entries, item])
  if (next.length === entries.length) return
  editor.view.dispatch(state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, entries: next }))
}

/**
 * 整体替换参考文献表的条目，供 AI 格式化建议回写用。条目 id 由调用方保证不变 ——
 * 正文里的引用标记按 id 找落点，换了 id 会让标记变成问号。
 */
export function replaceBibliographyEntries(
  editor: ReactNodeViewProps["editor"],
  items: CslItem[],
): boolean {
  const state = editor.state
  const pos = bibliographyPosition(state.doc)
  if (pos == null) return false

  const node = state.doc.nodeAt(pos)
  if (!node) return false

  const next = uniqueCslItems(items)
  const entries = (Array.isArray(node.attrs.entries) ? node.attrs.entries : []) as CslItem[]
  if (next.length === entries.length && next.every((item, index) => item === entries[index])) {
    return false
  }

  editor.view.dispatch(state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, entries: next }))
  return true
}

export function insertCitation(editor: ReactNodeViewProps["editor"], item: CslItem): void {
  upsertBibliographyEntry(editor, item)
  editor
    .chain()
    .focus()
    .insertContent({ type: CITATION_NODE, attrs: { refId: item.id, number: null } })
    .run()
}
