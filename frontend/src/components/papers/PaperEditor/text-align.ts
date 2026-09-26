import { Extension } from "@tiptap/react"

export type TextAlignment = "left" | "center" | "right" | "justify"

export interface TextAlignOptions {
  /** 允许对齐的块级节点类型（默认标题与段落） */
  types: string[]
  /** 允许的对齐值，超出这个集合的一律回落到默认值 */
  alignments: TextAlignment[]
  /** 默认对齐；等于默认值时不写 style，DOM 才不会平白多出一堆 text-align:left */
  defaultAlignment: TextAlignment
}

/**
 * 轻量文本对齐扩展：给标题/段落挂一个全局 textAlign 属性，用行内 style 承载。
 *
 * 只提供属性、不自定义命令——对齐由工具栏用内置的 updateAttributes 写入，
 * 这样不必对 @tiptap/core 做类型增强（本仓库其余扩展也都不做），tsc 更干净。
 * 不引官方 @tiptap/extension-text-align，是想把导出 HTML 的样式收敛到 style 上：
 * getHTML() 的结果要能脱离编辑器独立渲染（预览、导出 PDF），行内 style 比 class 更自足。
 */
export const TextAlign = Extension.create<TextAlignOptions>({
  name: "textAlign",

  addOptions() {
    return {
      types: ["heading", "paragraph"],
      alignments: ["left", "center", "right", "justify"],
      defaultAlignment: "left",
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          textAlign: {
            default: this.options.defaultAlignment,
            parseHTML: (element) => {
              const align = element.style.textAlign as TextAlignment
              return this.options.alignments.includes(align) ? align : this.options.defaultAlignment
            },
            renderHTML: (attributes) => {
              const align = attributes.textAlign as TextAlignment | undefined
              if (!align || align === this.options.defaultAlignment) return {}
              return { style: `text-align: ${align}` }
            },
          },
        },
      },
    ]
  },
})
