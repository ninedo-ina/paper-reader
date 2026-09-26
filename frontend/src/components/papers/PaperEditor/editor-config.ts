import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import { TextAlign } from "./text-align"

/**
 * The extension set shared by the editor component and its tests, so a test can
 * exercise the exact same schema and commands the user gets — without mounting a
 * full ProseMirror view.
 *
 * StarterKit 3 already bundles Bold, Italic, Strike, Underline, Code, CodeBlock,
 * Heading, BulletList, OrderedList, Blockquote, Link and Undo/Redo, so none of
 * those are added again here (doing so would register the extension twice).
 */
export function createPaperEditorExtensions(placeholder: string) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
    Placeholder.configure({ placeholder }),
    TextAlign,
  ]
}

export interface EditorStats {
  words: number
  characters: number
}

/**
 * Best-effort word/character counts from the editor's plain text.
 *
 * Whitespace-delimited word counting is imprecise for scripts without word
 * spacing (e.g. CJK); richer per-language counting is deferred to W9.
 * `characters` excludes whitespace.
 */
export function computeEditorStats(text: string): EditorStats {
  const trimmed = text.trim()
  const words = trimmed ? trimmed.split(/\s+/).length : 0
  const characters = text.replace(/\s/g, "").length
  return { words, characters }
}
