import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { JSONContent } from "@tiptap/react"
import { withIntl } from "@/test/intl"
import type { PaperContentDto, PaperDetailDto } from "@/lib/api/types"

const mocks = vi.hoisted(() => ({
  editor: {
    getJSON: vi.fn(),
    getHTML: vi.fn(),
    getText: vi.fn(() => ""),
    isActive: vi.fn(() => false),
    can: vi.fn(() => ({ undo: () => false, redo: () => false })),
    commands: { setContent: vi.fn() },
    // AI 写作工具栏要从 state 里读选区（textBetween）和参考文献表（descendants）
    state: {
      selection: { from: 1, to: 1, empty: true },
      doc: { textBetween: () => "", descendants: () => undefined },
    },
  },
  editorOptions: {} as { content?: unknown },
  getPaperContent: vi.fn(),
  updatePaperContent: vi.fn(),
  listContentSnapshots: vi.fn(),
  restoreContentSnapshot: vi.fn(),
}))

vi.mock("@tiptap/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tiptap/react")>()
  return {
    ...actual,
    useEditor: (options: { content?: unknown }) => {
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

vi.mock("@/lib/api/contentVersions", () => ({
  listContentSnapshots: mocks.listContentSnapshots,
  getContentSnapshot: vi.fn(),
  createContentSnapshot: vi.fn(),
  renameContentSnapshot: vi.fn(),
  restoreContentSnapshot: mocks.restoreContentSnapshot,
}))

vi.mock("@/components/reader/PDFViewer", () => ({
  PDFViewer: () => <div data-testid="pdf-viewer" />,
}))

import { PaperContentArea } from "@/components/papers/PaperContentArea"

const draftBody = (text: string): JSONContent => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
})

const manualPaper = {
  id: 7,
  title: "草稿",
  abstractText: null,
  sourceType: "MANUAL",
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

describe("从编辑器进入版本历史并回滚", () => {
  beforeEach(() => {
    mocks.editor.getJSON.mockReturnValue(draftBody("当前正文"))
    mocks.editor.getHTML.mockReturnValue("<p>当前正文</p>")
    mocks.editorOptions = {}
    mocks.getPaperContent.mockResolvedValue(
      contentDto({ contentJson: draftBody("当前正文"), contentHtml: "<p>当前正文</p>", contentVersion: 4 }),
    )
    mocks.listContentSnapshots.mockResolvedValue([
      {
        id: 11,
        paperId: 7,
        label: "初稿",
        source: "MANUAL",
        contentVersion: 2,
        createdAt: "2026-09-20T10:00:00Z",
      },
    ])
    mocks.restoreContentSnapshot.mockResolvedValue(
      contentDto({
        contentJson: draftBody("初稿正文"),
        contentHtml: "<p>初稿正文</p>",
        contentVersion: 5,
      }),
    )
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("编辑器顶栏能打开版本历史", async () => {
    render(withIntl(<PaperContentArea paper={manualPaper} />))
    await waitFor(() => expect(mocks.editorOptions.content).toEqual(draftBody("当前正文")))

    fireEvent.click(screen.getByRole("button", { name: /版本历史/ }))

    expect(await screen.findByText("初稿")).toBeInTheDocument()
    expect(mocks.listContentSnapshots).toHaveBeenCalledWith(7)
  })

  it("回滚后编辑器换上快照里的正文，并带上回滚后的新版本号继续保存", async () => {
    render(withIntl(<PaperContentArea paper={manualPaper} />))
    await waitFor(() => expect(mocks.editorOptions.content).toEqual(draftBody("当前正文")))

    fireEvent.click(screen.getByRole("button", { name: /版本历史/ }))
    await screen.findByText("初稿")
    fireEvent.click(screen.getByRole("button", { name: /回滚到此版本/ }))
    fireEvent.click(screen.getAllByRole("button", { name: /回滚到此版本/ })[1])

    // 编辑器被重建（key 变了）并读到快照正文 —— 回滚后的正文就是当前正文
    await waitFor(() => expect(mocks.editorOptions.content).toEqual(draftBody("初稿正文")))

    // 版本号必须同步到回滚产生的新版本，否则下一次保存会被当成后写覆盖而被拒
    mocks.updatePaperContent.mockResolvedValue(contentDto({ contentVersion: 6 }))
    fireEvent.click(screen.getByRole("button", { name: /^保存$/ }))

    await waitFor(() =>
      expect(mocks.updatePaperContent).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ baseVersion: 5 }),
      ),
    )
  })
})
