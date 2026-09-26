import { Extension } from "@tiptap/react"

export type TextAlignment = "left" | "center" | "right" | "justify"

export interface TextAlignOptions {
  /** Block node types that accept a `textAlign` attribute. */
  types: string[]
  /** Allowed alignment values. */
  alignments: TextAlignment[]
  /** Alignment that renders no inline style (the document default). */
  defaultAlignment: TextAlignment
}

/**
 * Minimal, dependency-free text-alignment extension.
 *
 * Adds a `textAlign` global attribute to block nodes (heading/paragraph) that
 * serialises to a `text-align` inline style. Alignment is applied from the
 * toolbar with the built-in `updateAttributes` command, so no custom command is
 * declared here — that keeps us clear of augmenting `@tiptap/core`'s `Commands`
 * interface (which pnpm does not hoist to the top level), and adds no new npm
 * dependency (we deliberately avoid `@tiptap/extension-text-align`).
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
              return this.options.alignments.includes(align)
                ? align
                : this.options.defaultAlignment
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
