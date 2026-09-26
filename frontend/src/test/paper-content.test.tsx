import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { JSONContent } from "@tiptap/react"
import { withIntl } from "@/test/intl"
import type { PaperContentDto, PaperDetailDto } from "@/lib/api/types"

const mocks = vi.hoisted(() => ({
  // isActive 是工具栏选状态、getText 是字数统计、can 是撤销/重做按钮要问编辑器的问题，桩里都得答得上来
  editor: {
    getJSON: vi.fn(),
    getHTML: vi.fn(),
    getText: vi.fn(() => ""),
    isActive: vi.fn(() => false),
    can: vi.fn(() => ({ undo: () => false, redo: () => false })),
  },
  editorOptions: {} as { content?: unknown; onUpdate?: () => void },
  getPaperContent: vi.fn(),
  updatePaperContent: vi.fn(),
}))

// 真 Tiptap 依赖大量浏览器布局能力，jsdom 里跑不稳；这里只桩掉编辑器生命周期，
// 用 editorOptions 抓住「编辑器拿到的是什么」、用 editor 抓住「保存时发出去的是什么」。
// Extension/Node 这类构造器必须保留真实实现：学术扩展要用它们建 schema。
vi.mock("@tiptap/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tiptap/react")>()
  return {
    ...actual,
    useEditor: (options: { content?: unknown; onUpdate?: () => void }) => {
      mocks.editorOptions = options
      return mocks.editor
    },
    useEditorState: ({ selector }: { selector: (context: unknown) => unknown }) =>
      selector({ editor: mocks.editor }),
    EditorContent: () => <div data-testid="editor" />,
  }
})

vi.mock("@/lib/api/papers", () => ({
  getPaperContent: mocks.getPaperContent,
  updatePaperContent: mocks.updatePaperContent,
}))

vi.mock("@/components/reader/PDFViewer", () => ({
  PDFViewer: () => <div data-testid="pdf-viewer" />,
}))

import { PaperEditor } from "@/components/papers/PaperEditor/PaperEditor"
import { PaperContentArea } from "@/components/papers/PaperContentArea"

const body: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "真实正文" }] }],
}

const manualPaper = {
  id: 7,
  title: "草稿",
  abstractText: "这是摘要，不是正文",
  sourceType: "MANUAL",
} as unknown as PaperDetailDto

const pdfPaper = {
  id: 8,
  title: "已上传的 PDF",
  abstractText: null,
  sourceType: "UPLOAD",
} as unknown as PaperDetailDto

function contentDto(overrides: Partial<PaperContentDto> = {}): PaperContentDto {
  return {
    paperId: 7,
    contentJson: null,
    contentHtml: null,
    contentVersion: 0,
    updatedAt: "2026-09-26T00:00:00Z",
    ...overrides,
  }
}

const saveButton = () => screen.getByRole("button", { name: /保存/ })

describe("论文正文的读写", () => {
  beforeEach(() => {
    mocks.editor.getJSON.mockReturnValue(body)
    mocks.editor.getHTML.mockReturnValue("<p>真实正文</p>")
    mocks.editorOptions = {}
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("sends the editor JSON as the authority and the rendered HTML as the derived copy", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(withIntl(<PaperEditor paper={manualPaper} content={body} onSave={onSave} />))

    fireEvent.click(saveButton())

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave).toHaveBeenCalledWith({ contentJson: body, contentHtml: "<p>真实正文</p>" })
  })

  it("opens with the stored body and never with the abstract", () => {
    render(withIntl(<PaperEditor paper={manualPaper} content={body} onSave={vi.fn()} />))

    expect(mocks.editorOptions.content).toEqual(body)
    expect(mocks.editorOptions.content).not.toEqual(manualPaper.abstractText)
  })

  it("marks the save as done and takes the mark back once the body changes again", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(withIntl(<PaperEditor paper={manualPaper} content={body} onSave={onSave} />))
    const onUpdate = mocks.editorOptions.onUpdate as () => void
    expect(onUpdate).toBeTypeOf("function")

    fireEvent.click(saveButton())
    expect(await screen.findByText("已保存")).toBeInTheDocument()

    act(() => onUpdate())
    await waitFor(() => expect(screen.queryByText("已保存")).not.toBeInTheDocument())
  })

  it("tells the user the body was not saved instead of failing silently", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("网络不可用"))
    render(withIntl(<PaperEditor paper={manualPaper} content={body} onSave={onSave} />))

    fireEvent.click(saveButton())

    expect(await screen.findByText("正文保存失败")).toBeInTheDocument()
  })

  it("loads the stored body into the editor for a manually created paper", async () => {
    mocks.getPaperContent.mockResolvedValue(contentDto({ contentJson: body, contentHtml: "<p>真实正文</p>", contentVersion: 1 }))

    render(withIntl(<PaperContentArea paper={manualPaper} />))

    await waitFor(() => expect(mocks.editorOptions.content).toEqual(body))
    expect(mocks.getPaperContent).toHaveBeenCalledWith(7)
    expect(mocks.editorOptions.content).not.toEqual(manualPaper.abstractText)
  })

  it("persists the body through the content endpoint, leaving the metadata path alone", async () => {
    mocks.getPaperContent.mockResolvedValue(contentDto())
    mocks.updatePaperContent.mockResolvedValue(contentDto({ contentJson: body, contentVersion: 1 }))

    render(withIntl(<PaperContentArea paper={manualPaper} />))
    // 编辑器是等正文读完才挂载的，它出现就说明加载这条路走完了；
    // 这篇论文还没写过正文，编辑器必须是空的，而不是拿摘要顶上。
    await waitFor(() => expect(screen.getByTestId("editor")).toBeInTheDocument())
    expect(mocks.getPaperContent).toHaveBeenCalledWith(7)
    expect(mocks.editorOptions.content).toBe("")
    expect(mocks.editorOptions.content).not.toEqual(manualPaper.abstractText)

    fireEvent.click(saveButton())

    await waitFor(() =>
      expect(mocks.updatePaperContent).toHaveBeenCalledWith(7, {
        contentJson: body,
        contentHtml: "<p>真实正文</p>",
      }),
    )
  })

  it("refuses to open a blank editor when the stored body cannot be read", async () => {
    mocks.getPaperContent.mockRejectedValue(new Error("网络不可用"))

    render(withIntl(<PaperContentArea paper={manualPaper} />))

    expect(await screen.findByText("正文加载失败")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /保存/ })).not.toBeInTheDocument()
  })

  it("never reads the content endpoint for an uploaded PDF", async () => {
    render(withIntl(<PaperContentArea paper={pdfPaper} />))

    expect(screen.getByTestId("pdf-viewer")).toBeInTheDocument()
    expect(mocks.getPaperContent).not.toHaveBeenCalled()
  })
})
