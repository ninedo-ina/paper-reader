import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { JSONContent } from "@tiptap/react"
import { withIntl } from "@/test/intl"
import { resetContentLimitsCache } from "@/hooks/useContentLimits"
import type { PaperContentDto, PaperDetailDto, ContentLimitsDto } from "@/lib/api/types"

const mocks = vi.hoisted(() => ({
  // isActive 是工具栏选状态、getText 是字数统计、can 是撤销/重做按钮要问编辑器的问题，桩里都得答得上来
  editor: {
    getJSON: vi.fn(),
    getHTML: vi.fn(),
    getText: vi.fn(() => ""),
    isActive: vi.fn(() => false),
    can: vi.fn(() => ({ undo: () => false, redo: () => false })),
    // AI 写作工具栏要从 state 里读选区（textBetween）和参考文献表（descendants）
    state: {
      selection: { from: 1, to: 1, empty: true },
      doc: { textBetween: () => "", descendants: () => undefined },
    },
  },
  editorOptions: {} as { content?: unknown; onUpdate?: () => void },
  getPaperContent: vi.fn(),
  updatePaperContent: vi.fn(),
  // 显式标出返回值类型，否则只从初值推出 Promise<null>，用例里再给限额就过不了类型检查
  getContentLimits: vi.fn<() => Promise<ContentLimitsDto | null>>(() => Promise.resolve(null)),
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
  // 默认拿不到限额：编辑器退回「全靠服务端拦」，用例要自检时再单独给值
  getContentLimits: mocks.getContentLimits,
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
        // 带上本地已知版本号，服务端才能判断这次写入是不是「后写覆盖」
        baseVersion: 0,
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

/** 改内容后不点保存，等防抖窗口过去就该自己落库（W3 自动保存） */
describe("正文自动保存", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.editor.getJSON.mockReturnValue(body)
    mocks.editor.getHTML.mockReturnValue("<p>真实正文</p>")
    mocks.editorOptions = {}
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it("saves by itself a couple of seconds after the typing stops", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(withIntl(<PaperEditor paper={manualPaper} content={body} onSave={onSave} />))

    act(() => (mocks.editorOptions.onUpdate as () => void)())
    // 防抖窗口内不动：还不该发请求，避免每敲一个字都写一次库
    expect(onSave).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ contentJson: body, contentHtml: "<p>真实正文</p>" })
    // 假定时器下 waitFor 的轮询不会前进，这里直接断言已经落到「已保存」
    expect(screen.getByText("已保存")).toBeInTheDocument()
  })

  it("keeps retrying in the background when the save fails", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("网络不可用"))
    render(withIntl(<PaperEditor paper={manualPaper} content={body} onSave={onSave} />))

    act(() => (mocks.editorOptions.onUpdate as () => void)())
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(onSave).toHaveBeenCalledTimes(1)
    // 断网不能让改动悄悄丢掉：给出失败提示，并留一个手动重试入口
    expect(screen.getByText("正文保存失败")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /重试/ })).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(5000)
    })
    expect(onSave).toHaveBeenCalledTimes(2)
  })
})

/** 两个标签页同时写同一篇正文时，后保存的一方必须被明确告知，而不是静默覆盖 */
describe("正文并发冲突", () => {
  const conflictError = Object.assign(new Error("内容已被其他会话更新"), { code: 1008 })

  beforeEach(() => {
    mocks.editor.getJSON.mockReturnValue(body)
    mocks.editor.getHTML.mockReturnValue("<p>真实正文</p>")
    mocks.editorOptions = {}
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("reports the overwrite instead of silently clobbering the other tab", async () => {
    const onSave = vi.fn().mockRejectedValue(conflictError)
    render(withIntl(<PaperEditor paper={manualPaper} content={body} onSave={onSave} />))

    fireEvent.click(saveButton())

    expect(await screen.findByText("内容已被其他会话更新")).toBeInTheDocument()
    // 冲突不是「未保存」，也不该被判成可重试的失败——重试仍然是覆盖别人的内容
    expect(screen.queryByText("正文保存失败")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /重试/ })).not.toBeInTheDocument()
  })

  it("reloads the other tab's version when the user asks for the latest", async () => {
    const latest: JSONContent = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "另一个标签页写的" }] }],
    }
    mocks.getPaperContent
      .mockResolvedValueOnce(contentDto({ contentJson: body, contentVersion: 3 }))
      .mockResolvedValueOnce(contentDto({ contentJson: latest, contentVersion: 5 }))
    mocks.updatePaperContent.mockRejectedValue(conflictError)

    render(withIntl(<PaperContentArea paper={manualPaper} />))
    await waitFor(() => expect(mocks.editorOptions.content).toEqual(body))

    fireEvent.click(saveButton())
    await screen.findByText("内容已被其他会话更新")

    // baseVersion 用的是读到的 3，而不是硬编码的 0
    expect(mocks.updatePaperContent).toHaveBeenCalledWith(7, expect.objectContaining({ baseVersion: 3 }))

    fireEvent.click(screen.getByRole("button", { name: /加载最新/ }))

    await waitFor(() => expect(mocks.editorOptions.content).toEqual(latest))
    expect(mocks.getPaperContent).toHaveBeenCalledTimes(2)
  })

  it("stops offering retry-but-overwrite once the conflict is known", async () => {
    // 保存失败 ≠ 冲突：只有冲突才隐藏重试入口（见上一个用例），这里确认普通失败仍给重试
    mocks.updatePaperContent.mockRejectedValue(new Error("网络不可用"))
    mocks.getPaperContent.mockResolvedValue(contentDto({ contentJson: body, contentVersion: 1 }))

    render(withIntl(<PaperContentArea paper={manualPaper} />))
    await waitFor(() => expect(mocks.editorOptions.content).toEqual(body))

    fireEvent.click(saveButton())

    expect(await screen.findByRole("button", { name: /重试/ })).toBeInTheDocument()
  })
})

/** 有未保存改动时离开页面要被拦下（W3 草稿保护） */
describe("未保存改动的离开拦截", () => {
  const dispatchBeforeUnload = () => {
    const event = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(event)
    return event
  }

  beforeEach(() => {
    mocks.editor.getJSON.mockReturnValue(body)
    mocks.editor.getHTML.mockReturnValue("<p>真实正文</p>")
    mocks.editorOptions = {}
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("raises the browser-native confirm once the body is dirty", async () => {
    render(withIntl(<PaperEditor paper={manualPaper} content={body} onSave={vi.fn()} />))
    // 编辑器挂载后会去读一次正文体积上限；这一拍不落定，卸载后的 setState 会报警告
    await act(async () => {})

    // 还没改动：不该打扰用户
    expect(dispatchBeforeUnload().defaultPrevented).toBe(false)

    act(() => (mocks.editorOptions.onUpdate as () => void)())
    expect(dispatchBeforeUnload().defaultPrevented).toBe(true)
  })

  it("stops blocking the way out after the changes are saved", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(withIntl(<PaperEditor paper={manualPaper} content={body} onSave={onSave} />))

    act(() => (mocks.editorOptions.onUpdate as () => void)())
    expect(dispatchBeforeUnload().defaultPrevented).toBe(true)

    fireEvent.click(saveButton())
    await screen.findByText("已保存")

    expect(dispatchBeforeUnload().defaultPrevented).toBe(false)
  })

  it("asks before following an in-app link while the body is dirty", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false)
    render(withIntl(<PaperEditor paper={manualPaper} content={body} onSave={vi.fn()} />))
    // 同上：等体积上限那次读取落定
    await act(async () => {})

    const link = document.createElement("a")
    link.href = "/papers/8"
    link.textContent = "另一篇"
    document.body.appendChild(link)
    try {
      act(() => (mocks.editorOptions.onUpdate as () => void)())

      const click = new MouseEvent("click", { bubbles: true, cancelable: true })
      link.dispatchEvent(click)

      expect(confirmSpy).toHaveBeenCalled()
      // 用户选择留下 → 这次跳转必须被取消
      expect(click.defaultPrevented).toBe(true)
    } finally {
      link.remove()
      confirmSpy.mockRestore()
    }
  })
})

/**
 * 写放大控制（W9）：同一份正文别反复写上去，注定被拒的正文也别重试到天荒地老。
 * 一份 8MB 的正文每 2 秒重发一次的代价是实打实的，这里把三道闸门钉住。
 */
describe("自动保存的写放大控制", () => {
  const tooLarge = Object.assign(new Error("正文体积超过单篇上限，请精简或拆分后再保存"), { code: 1014 })

  beforeEach(() => {
    // 限额走的是进程内缓存，用例之间必须清掉，否则前一个用例的限额会漏到这里
    resetContentLimitsCache()
    mocks.editor.getJSON.mockReturnValue(body)
    mocks.editor.getHTML.mockReturnValue("<p>真实正文</p>")
    mocks.editorOptions = {}
  })

  afterEach(() => {
    cleanup()
    mocks.getContentLimits.mockImplementation(() => Promise.resolve(null))
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it("内容与上次落库的一模一样时，不再重复提交", async () => {
    vi.useFakeTimers()
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(withIntl(<PaperEditor paper={manualPaper} content={body} onSave={onSave} />))

    act(() => (mocks.editorOptions.onUpdate as () => void)())
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(onSave).toHaveBeenCalledTimes(1)

    // 又动了一下编辑器，但内容与已落库的逐字节一致（撤销、键入又删掉）：不该再写一次库
    act(() => (mocks.editorOptions.onUpdate as () => void)())
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(screen.getByText("已保存")).toBeInTheDocument()
  })

  it("正文超出单篇上限时一个请求都不发，直接请用户精简", async () => {
    mocks.getContentLimits.mockResolvedValueOnce({
      maxJsonBytes: 10,
      maxHtmlBytes: 10,
      maxReadableBytes: 100,
      maxSnapshotCount: 5,
      maxSnapshotAgeDays: 30,
    })
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(withIntl(<PaperEditor paper={manualPaper} content={body} onSave={onSave} />))

    // 限额是异步读回来的；没读到就不自检，所以先等它落地
    await act(async () => {})

    fireEvent.click(saveButton())

    await waitFor(() => expect(screen.getByTestId("autosave-rejected")).toBeInTheDocument())
    expect(onSave).not.toHaveBeenCalled()
    // 提示要说清「多大 / 上限多少」，否则用户不知道该删多少
    const message = screen.getByTestId("autosave-rejected").textContent ?? ""
    expect(message).toContain("超过单篇上限")
    expect(message).toContain("10 B")
  })

  it("服务端判超限后停止重试，不再空转", async () => {
    vi.useFakeTimers()
    const onSave = vi.fn().mockRejectedValue(tooLarge)
    render(withIntl(<PaperEditor paper={manualPaper} content={body} onSave={onSave} />))

    fireEvent.click(saveButton())
    await act(async () => {})
    expect(onSave).toHaveBeenCalledTimes(1)

    expect(screen.getByTestId("autosave-rejected")).toHaveTextContent(tooLarge.message)
    // 与断网不同：重试一百次发出去的还是同一份超限正文，不该给重试入口
    expect(screen.queryByRole("button", { name: /重试/ })).not.toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(5000)
    })
    expect(onSave).toHaveBeenCalledTimes(1)
  })
})
