import { useState } from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { withIntl } from "@/test/intl"
import { academicExtensions } from "@/components/papers/PaperEditor/extensions"
import {
  AcademicToolbar,
  type MathDialogState,
} from "@/components/papers/PaperEditor/AcademicToolbar"
import { BIBLIOGRAPHY_NODE, collectBibliography } from "@/lib/academic-numbering"
import { paperToCslItem } from "@/lib/citations"
import { insertCitation } from "@/components/papers/PaperEditor/extensions/Citation"
import { insertFootnote } from "@/components/papers/PaperEditor/extensions/Footnote"

let editor: Editor | null = null

function createEditor(content = "<p>hello</p>") {
  editor = new Editor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      ...academicExtensions({
        locale: "en",
        footnoteTitle: "Footnotes",
        bibliographyTitle: "References",
        crossReferenceLabels: { formula: "Eq.", table: "Table", figure: "Fig.", unknown: "unresolved" },
      }),
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

describe("academic extension wiring", () => {
  it("keeps the latex source and a stable id alongside the rendered markup", () => {
    const instance = createEditor("<p>hello</p>")
    instance.commands.insertBlockMath({ latex: "E = mc^2" })

    const html = instance.getHTML()
    expect(html).toContain('data-type="block-math"')
    // 没有 data-latex 就没有回填源：HTML 再导入时公式只剩渲染结果，改不动了
    expect(html).toContain('data-latex="E = mc^2"')
    // 唯一 ID 由 UniqueID 扩展补上，交叉引用靠它定位
    expect(html).toMatch(/data-id="[0-9a-f-]{36}"/)
  })

  it("renders katex markup in getHTML so the exported document matches the editor", () => {
    const instance = createEditor("<p>hello</p>")
    instance.commands.insertBlockMath({ latex: "E = mc^2" })

    const html = instance.getHTML()
    expect(html).toContain("katex")
    // 上下标在编辑器里是 KaTeX 生成的 DOM，导出必须带上同一份 DOM，否则导出后公式是空的
    expect(html).toContain("mc")
    expect(html).toMatch(/katex-(html|mathml)/)
  })

  it("numbers a footnote and mirrors it into the endnote list", () => {
    const instance = createEditor("<p>body</p>")
    instance.commands.focus("end")
    insertFootnote(instance, "a footnote note")

    const html = instance.getHTML()
    expect(html).toContain('data-footnote-number="1"')
    expect(html).toContain('data-footnote-note="a footnote note"')
    expect(html).toContain('data-footnote-entry="')
    expect(html).toContain("a footnote note")
  })

  it("renumbers body citations when the bibliography is reordered", () => {
    const instance = createEditor("<p>body</p>")
    const first = paperToCslItem({ id: 1, title: "First source", doi: "10.1000/first" })
    const second = paperToCslItem({ id: 2, title: "Second source", doi: "10.1000/second" })

    instance.commands.focus("end")
    insertCitation(instance, first)
    insertCitation(instance, second)

    const numbers = () =>
      [...instance.getHTML().matchAll(/data-citation-number="(\d+)"/g)].map((match) => Number(match[1]))
    expect(numbers()).toEqual([1, 2])

    // 相当于在参考文献表里点"上移"：编号不落库，只由表顺序推导，正文必须跟着重排
    let bibliographyPos = -1
    instance.state.doc.descendants((node, pos) => {
      if (node.type.name === BIBLIOGRAPHY_NODE) bibliographyPos = pos
      return true
    })
    const entries = collectBibliography(instance.state.doc)
    const tr = instance.state.tr.setNodeMarkup(bibliographyPos, undefined, {
      ...instance.state.doc.nodeAt(bibliographyPos)?.attrs,
      entries: [entries[1], entries[0]],
    })
    instance.view.dispatch(tr)

    expect(collectBibliography(instance.state.doc).map((entry) => entry.id)).toEqual([second.id, first.id])
    expect(numbers()).toEqual([2, 1])
  })
})

const LABELS = { formula: "式", table: "表", figure: "图", unknown: "引用失效" }

/**
 * 公式弹层的开关状态在 PaperEditor 手里（扩展的 onClick 也是在那儿配的），
 * 这里用一个最小的宿主把它接起来，才能真的从按钮点进弹层再落回文档。
 */
function ToolbarHost({ instance }: { instance: Editor }) {
  const [mathDialog, setMathDialog] = useState<MathDialogState | null>(null)
  return (
    <AcademicToolbar
      editor={instance}
      labels={LABELS}
      mathDialog={mathDialog}
      onOpenMathDialog={setMathDialog}
    />
  )
}

function renderToolbar(content = "<p>body</p>") {
  const instance = createEditor(content)
  render(withIntl(<ToolbarHost instance={instance} />))
  return instance
}

const buttonNamed = (name: string) => screen.getByRole("button", { name })

describe("academic toolbar", () => {
  it("inserts a footnote written in the dialog and mirrors it into the endnote list", () => {
    const instance = renderToolbar()

    fireEvent.click(buttonNamed("插入脚注"))
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "见附录 A" } })
    fireEvent.click(buttonNamed("插入"))

    const html = instance.getHTML()
    expect(html).toContain('data-footnote-number="1"')
    expect(html).toContain('data-footnote-note="见附录 A"')
    // 正文只有一个上标、导出里没有文末条目的话，脚注就等于丢了
    expect(html).toContain('data-footnote-entry=')
    expect(html).toContain("1. 见附录 A")
  })

  it("refuses an empty footnote instead of inserting a blank marker", () => {
    const instance = renderToolbar()
    const before = instance.getHTML()

    fireEvent.click(buttonNamed("插入脚注"))
    fireEvent.click(buttonNamed("插入"))

    expect(screen.getByRole("alert")).toHaveTextContent("请输入脚注内容")
    expect(instance.getHTML()).toBe(before)
  })

  it("renders the latex typed in the dialog so the editor and the export agree", () => {
    const instance = renderToolbar()

    fireEvent.click(buttonNamed("公式块"))
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "E = mc^2" } })
    fireEvent.click(buttonNamed("插入"))

    const html = instance.getHTML()
    expect(html).toContain('data-type="block-math"')
    expect(html).toContain('data-latex="E = mc^2"')
    // 编辑器和导出读的是同一份 KaTeX DOM，少了它导出后公式是空的
    expect(html).toMatch(/katex-(html|mathml)/)
  })

  it("inserts a cross-reference that points back at the numbered formula", () => {
    const instance = renderToolbar()
    instance.commands.insertBlockMath({ latex: "a=b" })

    fireEvent.click(buttonNamed("交叉引用"))
    fireEvent.click(screen.getByRole("button", { name: "式 (1)" }))

    expect(instance.getHTML()).toContain('data-cross-ref-number="1"')
    expect(instance.getHTML()).toContain('data-cross-ref-kind="formula"')
  })

  it("says so when there is nothing to cross-reference yet", () => {
    renderToolbar()

    fireEvent.click(buttonNamed("交叉引用"))

    expect(screen.getByText("文档里还没有可引用的公式或表格")).toBeInTheDocument()
  })
})
