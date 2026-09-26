import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { withIntl } from "@/test/intl"
import { FormatToolbar } from "@/components/papers/PaperEditor/FormatToolbar"
import { TextAlign } from "@/components/papers/PaperEditor/text-align"
import { computeEditorStats } from "@/components/papers/PaperEditor/editor-stats"

let editor: Editor | null = null

// 基础工具栏只驱动 StarterKit + TextAlign 这套排版能力，测试就用同一套无头编辑器，
// 不拉进公式/表格等 W4 扩展，命令层断言才干净、稳定。
function createEditor(content = "<p>hello</p>") {
  editor = new Editor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content,
  })
  return editor
}

afterEach(() => {
  cleanup()
  editor?.destroy()
  editor = null
})

describe("computeEditorStats", () => {
  it("counts space-separated latin words", () => {
    expect(computeEditorStats("hello world foo")).toEqual({ words: 3, characters: 13 })
  })

  it("counts每个汉字为一个词，中英混排也数得准", () => {
    expect(computeEditorStats("你好 world")).toEqual({ words: 3, characters: 7 })
    expect(computeEditorStats("中文测试")).toEqual({ words: 4, characters: 4 })
  })

  it("treats blank content as empty", () => {
    expect(computeEditorStats("   \n  ")).toEqual({ words: 0, characters: 0 })
  })
})

describe("format commands write into content", () => {
  it.each<[string, (e: Editor) => void, RegExp]>([
    ["bold", (e) => e.chain().selectAll().toggleBold().run(), /<strong>/],
    ["italic", (e) => e.chain().selectAll().toggleItalic().run(), /<em>/],
    ["underline", (e) => e.chain().selectAll().toggleUnderline().run(), /<u>/],
    ["strikethrough", (e) => e.chain().selectAll().toggleStrike().run(), /<s>/],
    ["inline code", (e) => e.chain().selectAll().toggleCode().run(), /<code>/],
    ["heading", (e) => e.chain().selectAll().toggleHeading({ level: 2 }).run(), /<h2/],
    ["bullet list", (e) => e.chain().selectAll().toggleBulletList().run(), /<ul>/],
    ["ordered list", (e) => e.chain().selectAll().toggleOrderedList().run(), /<ol>/],
    ["blockquote", (e) => e.chain().selectAll().toggleBlockquote().run(), /<blockquote>/],
    ["code block", (e) => e.chain().selectAll().toggleCodeBlock().run(), /<pre>/],
    ["align", (e) => e.chain().selectAll().updateAttributes("paragraph", { textAlign: "center" }).run(), /text-align: center/],
    ["link", (e) => e.chain().selectAll().setLink({ href: "https://example.test" }).run(), /href="https:\/\/example\.test"/],
  ])("%s produces visible markup", (_name, run, pattern) => {
    const instance = createEditor("<p>hello</p>")
    run(instance)
    expect(instance.getHTML()).toMatch(pattern)
  })

  it("clears alignment back to the default (no inline style)", () => {
    const instance = createEditor("<p>hello</p>")
    instance.chain().selectAll().updateAttributes("paragraph", { textAlign: "center" }).run()
    expect(instance.getHTML()).toMatch(/text-align: center/)
    instance.chain().selectAll().updateAttributes("paragraph", { textAlign: "left" }).run()
    expect(instance.getHTML()).not.toMatch(/text-align/)
  })
})

const buttonNamed = (name: string) => screen.getByRole("button", { name })

describe("FormatToolbar", () => {
  it("renders nothing until an editor exists", () => {
    render(withIntl(<FormatToolbar editor={null} />))
    expect(screen.queryByRole("toolbar")).toBeNull()
  })

  it("exposes the toolbar and one button per format category", () => {
    render(withIntl(<FormatToolbar editor={createEditor()} />))
    expect(screen.getByRole("toolbar", { name: "格式" })).toBeInTheDocument()
    for (const name of [
      "撤销",
      "重做",
      "标题 1",
      "正文",
      "加粗",
      "斜体",
      "下划线",
      "删除线",
      "无序列表",
      "有序列表",
      "引用",
      "代码块",
      "左对齐",
      "居中对齐",
      "右对齐",
      "链接",
    ]) {
      expect(buttonNamed(name)).toBeInTheDocument()
    }
  })

  it("turns the paragraph into a heading when the heading button is pressed", () => {
    const instance = createEditor("<p>hello</p>")
    render(withIntl(<FormatToolbar editor={instance} />))
    // 按钮走 mousedown（阻止默认以保住选区），不是 click
    fireEvent.mouseDown(buttonNamed("标题 2"))
    expect(instance.getHTML()).toMatch(/<h2/)
  })

  it("reflects the active format as an aria-pressed state", () => {
    const instance = createEditor("<p><strong>hello</strong></p>")
    instance.commands.selectAll()
    render(withIntl(<FormatToolbar editor={instance} />))
    expect(buttonNamed("加粗")).toHaveAttribute("aria-pressed", "true")
    expect(buttonNamed("斜体")).toHaveAttribute("aria-pressed", "false")
  })

  it("disables undo until there is history", () => {
    render(withIntl(<FormatToolbar editor={createEditor()} />))
    expect(buttonNamed("撤销")).toBeDisabled()
  })
})
