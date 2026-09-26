import { afterEach, describe, expect, it } from "vitest"
import { Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { academicExtensions } from "@/components/papers/PaperEditor/extensions"
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
