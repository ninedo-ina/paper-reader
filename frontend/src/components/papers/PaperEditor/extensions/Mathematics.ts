import type { DOMOutputSpec, Node as PMNode } from "@tiptap/pm/model"
import { BlockMath, InlineMath } from "@tiptap/extension-mathematics"
import { mergeAttributes } from "@tiptap/react"
import katex from "katex"

/**
 * 官方数学节点的 renderHTML 只输出 data-latex，不带渲染结果 —— 编辑器里靠 NodeView 现渲染，
 * 一旦走 `editor.getHTML()`（导出、剪贴板、持久化）公式就变成空的。
 * 验收要求"公式在编辑器与导出 PDF 中渲染一致"，所以这里把 KaTeX 的结果直接写进导出的 DOM。
 *
 * 两边都走同一份 katexOptions，包括 displayMode：官方 NodeView 的 katexOptions 默认是 undefined，
 * 行间公式会被当成行内公式渲染，导出时若不跟着一起错就会不一致。
 */
const KATEX_OPTIONS = { throwOnError: false, strict: false } as const

function renderKatexElement(latex: string, displayMode: boolean): HTMLElement | null {
  // renderHTML 会在没有 DOM 的环境被调用（比如服务端序列化），此时退化成纯文本
  if (typeof document === "undefined") return null

  const element = document.createElement(displayMode ? "div" : "span")
  element.className = displayMode ? "academic-math-block" : "academic-math-inline"
  try {
    katex.render(latex, element, { ...KATEX_OPTIONS, displayMode })
  } catch {
    element.textContent = latex
  }
  return element
}

function mathRenderHTML(displayMode: boolean) {
  return function renderHTML({
    node,
    HTMLAttributes,
  }: {
    // 与 @tiptap/core 的 NodeConfig.renderHTML 入参保持一致
    node: PMNode
    HTMLAttributes: Record<string, string>
  }): DOMOutputSpec {
    const latex = String(node.attrs.latex ?? "")
    const rendered = renderKatexElement(latex, displayMode)
    return [
      displayMode ? "div" : "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": displayMode ? "block-math" : "inline-math",
        class: "tiptap-mathematics-render",
      }),
      rendered ?? latex,
    ]
  }
}

export const AcademicBlockMath = BlockMath.extend({
  renderHTML: mathRenderHTML(true),
}).configure({ katexOptions: { ...KATEX_OPTIONS, displayMode: true } })

export const AcademicInlineMath = InlineMath.extend({
  renderHTML: mathRenderHTML(false),
}).configure({ katexOptions: { ...KATEX_OPTIONS, displayMode: false } })
