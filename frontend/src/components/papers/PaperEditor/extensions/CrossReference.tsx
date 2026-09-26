"use client"

import {
  mergeAttributes,
  Node,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from "@tiptap/react"
import { useTranslations } from "next-intl"
import {
  collectNumberedTargets,
  CROSS_REFERENCE_NODE,
  type NumberedTargetKind,
} from "@/lib/academic-numbering"
import { flashElement } from "./scroll"

export interface CrossReferenceLabels {
  formula: string
  table: string
  figure: string
  unknown: string
}

const DEFAULT_LABELS: CrossReferenceLabels = {
  formula: "Eq.",
  table: "Table",
  figure: "Fig.",
  unknown: "unresolved",
}

/** 标签与编号拼一起，"见式 (3)"里的"见"由用户自己敲，节点只管目标那一截。 */
export function crossReferenceText(
  labels: CrossReferenceLabels,
  kind: NumberedTargetKind | string,
  number: number | null,
): string {
  const label = labels[kind as NumberedTargetKind] ?? labels.unknown
  return number == null ? `${label} (?)` : `${label} (${number})`
}

export const CrossReference = Node.create({
  name: CROSS_REFERENCE_NODE,
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { labels: DEFAULT_LABELS }
  },

  addAttributes() {
    return {
      targetId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-cross-ref-target"),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.targetId ? { "data-cross-ref-target": attributes.targetId } : {},
      },
      kind: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-cross-ref-kind"),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.kind ? { "data-cross-ref-kind": attributes.kind } : {},
      },
      number: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const raw = element.getAttribute("data-cross-ref-number")
          if (raw == null) return null
          const value = Number.parseInt(raw, 10)
          return Number.isFinite(value) ? value : null
        },
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.number == null ? {} : { "data-cross-ref-number": String(attributes.number) },
      },
    }
  },

  parseHTML() {
    return [{ tag: "span[data-cross-ref-target]" }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const labels = this.options.labels as CrossReferenceLabels
    return [
      "span",
      mergeAttributes(HTMLAttributes, { class: "academic-cross-ref" }),
      crossReferenceText(labels, String(node.attrs.kind ?? ""), node.attrs.number ?? null),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CrossReferenceView)
  },
})

function CrossReferenceView({ editor, node, extension }: ReactNodeViewProps) {
  const t = useTranslations("papers")
  const labels = extension.options.labels as CrossReferenceLabels
  const targetId = String(node.attrs.targetId ?? "")
  const number = node.attrs.number ?? null
  const unresolved = number == null

  const jump = () => {
    const target = collectNumberedTargets(editor.state.doc).find((item) => item.id === targetId)
    if (!target) return
    // 目标在文档里是普通块节点，没有可查的属性，只能按位置取它的 DOM。
    const dom = editor.view.nodeDOM(target.pos)
    if (!(dom instanceof HTMLElement)) return
    dom.scrollIntoView({ block: "center", behavior: "smooth" })
    flashElement(dom)
  }

  return (
    <NodeViewWrapper
      as="span"
      className={unresolved ? "academic-cross-ref is-unresolved" : "academic-cross-ref"}
      data-cross-ref-target={targetId}
      contentEditable={false}
    >
      <button
        type="button"
        className="academic-cross-ref-marker"
        title={unresolved ? t("crossReferenceUnknown") : t("crossReferenceTitle")}
        aria-label={t("crossReferenceTitle")}
        onClick={jump}
      >
        {crossReferenceText(labels, String(node.attrs.kind ?? ""), number)}
      </button>
    </NodeViewWrapper>
  )
}
