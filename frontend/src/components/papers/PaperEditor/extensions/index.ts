import type { Extensions } from "@tiptap/react"
import { TableKit } from "@tiptap/extension-table"
import { UniqueID } from "@tiptap/extension-unique-id"
import { AcademicNumbering } from "./AcademicNumbering"
import { Bibliography, Citation } from "./Citation"
import { CrossReference, type CrossReferenceLabels } from "./CrossReference"
import { FootnoteList, FootnoteReference } from "./Footnote"
import { AcademicBlockMath, AcademicInlineMath } from "./Mathematics"

export { AcademicNumbering } from "./AcademicNumbering"
export { AcademicBlockMath, AcademicInlineMath } from "./Mathematics"
export * from "./Citation"
export * from "./CrossReference"
export * from "./Footnote"
export { findAnnotatedElement, flashElement, revealAnnotation } from "./scroll"

export interface AcademicExtensionOptions {
  locale: string
  footnoteTitle: string
  bibliographyTitle: string
  crossReferenceLabels: CrossReferenceLabels
  /** 点击公式节点（官方 NodeView 的 onClick）：编辑器用它开"编辑公式"弹层。 */
  onMathClick?: (kind: "inlineMath" | "blockMath", latex: string, pos: number) => void
}

/**
 * W4 学术写作能力扩展集合：公式（行内 + 行间）、表格、脚注、引用与参考文献、交叉引用。
 *
 * 编号目标必须带稳定 ID，UniqueID 只管公式与表格；
 * 将来加图片（v0.1.53）时，这里和 academic-numbering 的 NUMBERED_TARGET_NODES 要同时补上，
 * 否则交叉引用会指向一个没有编号的节点。
 */
export function academicExtensions(options: AcademicExtensionOptions): Extensions {
  const onMathClick = options.onMathClick

  return [
    AcademicInlineMath.configure({
      onClick: onMathClick
        ? (node, pos) => onMathClick("inlineMath", String(node.attrs.latex ?? ""), pos)
        : undefined,
    }),
    AcademicBlockMath.configure({
      onClick: onMathClick
        ? (node, pos) => onMathClick("blockMath", String(node.attrs.latex ?? ""), pos)
        : undefined,
    }),
    TableKit,
    UniqueID.configure({ types: ["blockMath", "table"] }),
    AcademicNumbering,
    FootnoteReference,
    FootnoteList.configure({ title: options.footnoteTitle }),
    Citation,
    Bibliography.configure({ locale: options.locale, title: options.bibliographyTitle }),
    CrossReference.configure({ labels: options.crossReferenceLabels }),
  ]
}
