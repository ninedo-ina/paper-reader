import { describe, expect, it } from "vitest"
import { getSchema } from "@tiptap/react"
import { EditorState } from "@tiptap/pm/state"
import type { Node as PMNode } from "@tiptap/pm/model"
import StarterKit from "@tiptap/starter-kit"
import {
  BIBLIOGRAPHY_NODE,
  CITATION_NODE,
  CROSS_REFERENCE_NODE,
  FOOTNOTE_LIST_NODE,
  FOOTNOTE_REFERENCE_NODE,
  collectCitationNumbers,
  collectFootnotes,
  collectNumberedTargets,
  numberingTransaction,
} from "@/lib/academic-numbering"
import { academicExtensions } from "@/components/papers/PaperEditor/extensions"
import { cslYear, paperToCslItem, referenceIdForPaper, referenceUrl } from "@/lib/citations"

const extensions = [
  StarterKit,
  ...academicExtensions({
    locale: "en",
    footnoteTitle: "Footnotes",
    bibliographyTitle: "References",
    crossReferenceLabels: { formula: "Eq.", table: "Table", figure: "Fig.", unknown: "unresolved" },
  }),
]

const schema = getSchema(extensions)

const FIRST = {
  id: "doi:10.1000/first",
  type: "article-journal",
  title: "First source",
  DOI: "10.1000/first",
}
const SECOND = {
  id: "doi:10.1000/second",
  type: "article-journal",
  title: "Second source",
  DOI: "10.1000/second",
}

/**
 * 文档结构固定成这样：两条公式、一张表、一条脚注、两处引用（正文出现顺序与文献表顺序相反）、
 * 一处指向第二条公式的交叉引用，末尾是脚注表与文献表。
 */
function buildDocEntries(bibliographyEntries: unknown[] = [SECOND, FIRST]) {
  return [
    { type: "paragraph", content: [{ type: "text", text: "intro" }] },
    { type: "blockMath", attrs: { id: "bm-1", latex: "a=b" } },
    { type: "paragraph", content: [{ type: "text", text: "cited below" }] },
    { type: "blockMath", attrs: { id: "bm-2", latex: "c=d" } },
    {
      type: "table",
      attrs: { id: "tbl-1" },
      content: [
        {
          type: "tableRow",
          content: [{ type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "h" }] }] }],
        },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "see " },
        { type: CROSS_REFERENCE_NODE, attrs: { targetId: "bm-2", kind: "formula", number: null } },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "cites " },
        { type: CITATION_NODE, attrs: { refId: FIRST.id, number: null } },
        { type: "text", text: " and " },
        { type: CITATION_NODE, attrs: { refId: SECOND.id, number: null } },
        { type: FOOTNOTE_REFERENCE_NODE, attrs: { id: "fn-a", note: "first note" } },
      ],
    },
    { type: FOOTNOTE_LIST_NODE, attrs: { entries: [] } },
    { type: BIBLIOGRAPHY_NODE, attrs: { entries: bibliographyEntries } },
  ]
}

function docFrom(entries: unknown[]): PMNode {
  return schema.nodeFromJSON({ type: "doc", content: entries })
}

function makeState(doc: PMNode) {
  return EditorState.create({ schema, doc })
}

/** 反复跑编号事务直到不动为止，模拟插件 appendTransaction 的实际收敛过程。 */
function settle(doc: PMNode): PMNode {
  let state = makeState(doc)
  for (let round = 0; round < 5; round += 1) {
    const tr = numberingTransaction(state)
    if (!tr) return state.doc
    state = state.apply(tr)
  }
  throw new Error("numbering did not converge")
}

function attrsOf(doc: PMNode, typeName: string): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = []
  doc.descendants((node) => {
    if (node.type.name === typeName) found.push(node.attrs)
    return true
  })
  return found
}

describe("academic numbering", () => {
  it("numbers footnotes, formulas and tables in document order", () => {
    const doc = settle(docFrom(buildDocEntries()))

    expect(collectFootnotes(doc)).toEqual([{ id: "fn-a", note: "first note", number: 1, pos: expect.any(Number) }])
    expect(collectNumberedTargets(doc).map(({ id, kind, number }) => ({ id, kind, number }))).toEqual([
      { id: "bm-1", kind: "formula", number: 1 },
      { id: "bm-2", kind: "formula", number: 2 },
      { id: "tbl-1", kind: "table", number: 1 },
    ])
  })

  it("writes derived data back into node attributes so getHTML sees the same numbers", () => {
    const doc = settle(docFrom(buildDocEntries()))

    expect(attrsOf(doc, CITATION_NODE).map((attrs) => [attrs.refId, attrs.number])).toEqual([
      [FIRST.id, 2],
      [SECOND.id, 1],
    ])
    expect(attrsOf(doc, CROSS_REFERENCE_NODE)[0].number).toBe(2)
    expect(attrsOf(doc, FOOTNOTE_REFERENCE_NODE)[0].number).toBe(1)
    expect(attrsOf(doc, FOOTNOTE_LIST_NODE)[0].entries).toEqual([
      { id: "fn-a", note: "first note", number: 1 },
    ])
  })

  it("is idempotent: a settled document produces no further transaction", () => {
    const doc = settle(docFrom(buildDocEntries()))
    expect(numberingTransaction(makeState(doc))).toBeNull()
  })

  it("renumbers body citations when the bibliography order changes", () => {
    const doc = settle(docFrom(buildDocEntries()))
    const before = collectCitationNumbers(doc)
    expect([before.get(FIRST.id), before.get(SECOND.id)]).toEqual([2, 1])

    // 等价于在文献表里点一次"上移"：换掉 entries 的顺序，编号必须跟着正文一起重排
    let state = makeState(doc)
    let bibliographyPos = -1
    state.doc.descendants((node, pos) => {
      if (node.type.name === BIBLIOGRAPHY_NODE) bibliographyPos = pos
      return true
    })
    state = state.apply(
      state.tr.setNodeMarkup(bibliographyPos, undefined, { ...state.doc.nodeAt(bibliographyPos)?.attrs, entries: [FIRST, SECOND] }),
    )

    const settled = settle(state.doc)
    expect(collectCitationNumbers(settled).get(FIRST.id)).toBe(1)
    expect(collectCitationNumbers(settled).get(SECOND.id)).toBe(2)
    expect(attrsOf(settled, CITATION_NODE).map((attrs) => attrs.number)).toEqual([1, 2])
  })

  it("keeps numbering citations that are missing from the bibliography instead of blanking them", () => {
    const entries = buildDocEntries()
    entries.push({
      type: "paragraph",
      content: [{ type: CITATION_NODE, attrs: { refId: "manual:orphan", number: null } }],
    })
    const doc = settle(docFrom(entries))

    expect(collectCitationNumbers(doc).get("manual:orphan")).toBe(3)
  })

  it("counts a footnote referenced twice only once", () => {
    const entries = buildDocEntries()
    entries.splice(entries.length - 2, 0, {
      type: "paragraph",
      content: [{ type: FOOTNOTE_REFERENCE_NODE, attrs: { id: "fn-a", note: "first note" } }],
    })
    const doc = settle(docFrom(entries))

    expect(collectFootnotes(doc)).toHaveLength(1)
    expect(attrsOf(doc, FOOTNOTE_LIST_NODE)[0].entries).toHaveLength(1)
  })
})

describe("csl item mapping", () => {
  it("prefers the DOI as the stable reference id", () => {
    expect(referenceIdForPaper({ id: 7, doi: "10.1000/ABC" })).toBe("doi:10.1000/abc")
    expect(referenceIdForPaper({ id: 7 })).toBe("paper:7")
  })

  it("maps a library paper onto a csl item with a resolvable link", () => {
    const item = paperToCslItem({
      id: 7,
      title: "A paper",
      authors: "Doe, J.; Smith, A.",
      doi: "10.1000/abc",
      year: "2024",
      journal: "Journal of Tests",
    })

    expect(item.id).toBe("doi:10.1000/abc")
    expect(item["container-title"]).toBe("Journal of Tests")
    expect(cslYear(item)).toBe(2024)
    expect(referenceUrl(item)).toBe("https://doi.org/10.1000/abc")
  })
})
