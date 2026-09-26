import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Editor } from "@tiptap/react"
import { withIntl } from "@/test/intl"
import { PaperEditor } from "@/components/papers/PaperEditor/PaperEditor"
import {
  computeEditorStats,
  createPaperEditorExtensions,
} from "@/components/papers/PaperEditor/editor-config"
import type { PaperDetailDto } from "@/lib/api/types"

const paper = {
  id: 1,
  title: "My Manual Paper",
  category: "OTHER",
  favorite: false,
  sourceType: "MANUAL",
  hasOriginalFile: false,
  createdAt: "2026-09-26T00:00:00Z",
  updatedAt: "2026-09-26T00:00:00Z",
} as unknown as PaperDetailDto

function makeEditor(content = "<p>hello world</p>") {
  return new Editor({ extensions: createPaperEditorExtensions("placeholder"), content })
}

describe("computeEditorStats", () => {
  it("counts whitespace-delimited words and non-whitespace characters", () => {
    expect(computeEditorStats("hello world foo")).toEqual({ words: 3, characters: 13 })
    expect(computeEditorStats("   ")).toEqual({ words: 0, characters: 0 })
    expect(computeEditorStats("")).toEqual({ words: 0, characters: 0 })
  })
})

// Exercises the exact schema/commands the toolbar dispatches, without a DOM view.
describe("paper editor content commands", () => {
  const cases: { name: string; apply: (e: Editor) => void; expected: RegExp }[] = [
    { name: "bold", apply: (e) => e.chain().selectAll().toggleBold().run(), expected: /<strong>/ },
    { name: "italic", apply: (e) => e.chain().selectAll().toggleItalic().run(), expected: /<em>/ },
    { name: "underline", apply: (e) => e.chain().selectAll().toggleUnderline().run(), expected: /<u>/ },
    { name: "strikethrough", apply: (e) => e.chain().selectAll().toggleStrike().run(), expected: /<s>/ },
    { name: "heading", apply: (e) => e.chain().selectAll().toggleHeading({ level: 2 }).run(), expected: /<h2/ },
    { name: "bullet list", apply: (e) => e.chain().selectAll().toggleBulletList().run(), expected: /<ul>/ },
    { name: "ordered list", apply: (e) => e.chain().selectAll().toggleOrderedList().run(), expected: /<ol>/ },
    { name: "blockquote", apply: (e) => e.chain().selectAll().toggleBlockquote().run(), expected: /<blockquote>/ },
    { name: "code block", apply: (e) => e.chain().selectAll().toggleCodeBlock().run(), expected: /<pre>/ },
    { name: "alignment", apply: (e) => e.chain().selectAll().updateAttributes("paragraph", { textAlign: "center" }).run(), expected: /text-align: center/ },
  ]

  for (const c of cases) {
    it(`writes ${c.name} into the document`, () => {
      const editor = makeEditor()
      c.apply(editor)
      expect(editor.getHTML()).toMatch(c.expected)
      editor.destroy()
    })
  }
})

describe("PaperEditor component", () => {
  afterEach(cleanup)

  it("renders a formatting toolbar with each format category when editable", async () => {
    render(withIntl(<PaperEditor paper={paper} content={null} onSave={vi.fn().mockResolvedValue(undefined)} />))
    expect(await screen.findByRole("toolbar", { name: "Formatting" })).toBeInTheDocument()
    for (const label of [
      "Bold", "Italic", "Underline", "Strikethrough", "Inline code",
      "Heading 1", "Bullet list", "Numbered list", "Blockquote", "Code block",
      "Align left", "Align center", "Align right", "Link", "Undo", "Redo",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument()
    }
  })

  it("hands the caller both JSON and HTML on manual save", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(withIntl(<PaperEditor paper={paper} content={null} onSave={onSave} />))
    await screen.findByRole("toolbar", { name: "Formatting" })

    fireEvent.click(screen.getByRole("button", { name: "保存" }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const payload = onSave.mock.calls[0][0]
    expect(payload.contentJson).toBeTypeOf("object")
    expect(payload.contentHtml).toBeTypeOf("string")
  })
})
