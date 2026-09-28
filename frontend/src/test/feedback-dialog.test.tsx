import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { FeedbackDialog } from "@/components/layout/FeedbackDialog"
import { withIntl } from "./intl"
import { submitFeedback } from "@/lib/api/feedback"

vi.mock("@/lib/api/feedback")
vi.mock("next/navigation", () => ({
  usePathname: () => "/zh/papers/1",
}))

function shot(name = "shot.png", type = "image/png", size = 16) {
  return new File([new Uint8Array(size)], name, { type })
}

/** 组件的粘贴监听挂在 document 上，jsdom 没有真的 DataTransfer，造一个够用的 items 就行 */
function paste(files: File[]) {
  const event = new Event("paste", { bubbles: true, cancelable: true })
  Object.defineProperty(event, "clipboardData", {
    value: { items: files.map((file) => ({ type: file.type, getAsFile: () => file })) },
  })
  act(() => {
    document.dispatchEvent(event)
  })
}

function openDialog() {
  render(withIntl(<FeedbackDialog />))
  fireEvent.click(screen.getByRole("button", { name: "问题反馈" }))
}

function fill(title = "标题", content = "内容") {
  fireEvent.change(screen.getByPlaceholderText("一句话说清是啥事"), { target: { value: title } })
  fireEvent.change(screen.getByPlaceholderText("想说什么都行，越具体越好"), {
    target: { value: content },
  })
}

function previewCount() {
  return document.querySelectorAll('img[src^="data:"]').length
}

describe("FeedbackDialog 问题反馈", () => {
  beforeEach(() => {
    vi.mocked(submitFeedback).mockResolvedValue({ id: 7, screenshotCount: 0 })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("顶栏是一个「馈」字按钮，点了才弹窗", () => {
    render(withIntl(<FeedbackDialog />))

    const trigger = screen.getByRole("button", { name: "问题反馈" })
    expect(trigger).toHaveTextContent("馈")
    expect(screen.queryByText("有事儿您说话")).not.toBeInTheDocument()

    fireEvent.click(trigger)

    expect(screen.getByText("有事儿您说话")).toBeInTheDocument()
    expect(screen.getByText("标题")).toBeInTheDocument()
    expect(screen.getByText("内容")).toBeInTheDocument()
    expect(screen.getByText("截图")).toBeInTheDocument()
  })

  it("标题或内容为空时先拦下来，不打接口", () => {
    openDialog()

    fireEvent.click(screen.getByRole("button", { name: "发出去" }))
    expect(screen.getByText("标题还没写呢")).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText("一句话说清是啥事"), { target: { value: "标题" } })
    fireEvent.click(screen.getByRole("button", { name: "发出去" }))
    expect(screen.getByText("内容还没写呢")).toBeInTheDocument()

    expect(submitFeedback).not.toHaveBeenCalled()
  })

  it("提交时带上页面路径、语言和截图，成功后给回执", async () => {
    openDialog()
    fill()
    paste([shot()])
    await waitFor(() => expect(previewCount()).toBe(1))

    fireEvent.click(screen.getByRole("button", { name: "发出去" }))

    await waitFor(() => expect(submitFeedback).toHaveBeenCalledTimes(1))
    const [input, screenshots] = vi.mocked(submitFeedback).mock.calls[0]
    expect(input).toMatchObject({
      title: "标题",
      content: "内容",
      pagePath: "/zh/papers/1",
      locale: "zh",
    })
    expect(input.appVersion).toEqual(expect.any(String))
    expect(screenshots.map((file) => file.name)).toEqual(["shot.png"])

    expect(await screen.findByText("收到了，回见！")).toBeInTheDocument()
  })

  it("发不出去时提示重试，不装作成功", async () => {
    vi.mocked(submitFeedback).mockRejectedValue(new Error("boom"))
    openDialog()
    fill()

    fireEvent.click(screen.getByRole("button", { name: "发出去" }))

    expect(await screen.findByText("没发出去，待会儿再试试")).toBeInTheDocument()
    expect(screen.queryByText("收到了，回见！")).not.toBeInTheDocument()
  })

  it("剪切板里的图片直接就能沾上，非图片的内容不理会", async () => {
    openDialog()

    paste([shot("clip.png")])
    await waitFor(() => expect(previewCount()).toBe(1))

    // 剪贴板里的纯文本是给输入框的，不该在这里冒出「有几张没加进去」
    paste([new File([new Uint8Array(8)], "note.txt", { type: "text/plain" })])

    expect(screen.queryByText(/有几张没加进去/)).not.toBeInTheDocument()
    expect(previewCount()).toBe(1)
  })

  it("选图时不在白名单里的和超过 5MB 的都挡在本地，不发给服务端", async () => {
    openDialog()
    const input = document.querySelector('input[type="file"]')!

    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array(8)], "scan.tiff", { type: "image/tiff" })] },
    })
    expect(screen.getByText(/有几张没加进去/)).toBeInTheDocument()

    fireEvent.change(input, {
      target: { files: [shot("huge.png", "image/png", 5 * 1024 * 1024 + 1)] },
    })

    expect(previewCount()).toBe(0)
    fill()
    fireEvent.click(screen.getByRole("button", { name: "发出去" }))
    await waitFor(() => expect(submitFeedback).toHaveBeenCalledTimes(1))
    expect(vi.mocked(submitFeedback).mock.calls[0][1]).toHaveLength(0)
  })

  it("最多 3 张，多出来的挡掉并提示，只发 3 张", async () => {
    openDialog()
    fill()

    paste([shot("a.png"), shot("b.png"), shot("c.png"), shot("d.png")])
    await waitFor(() => expect(previewCount()).toBe(3))
    expect(screen.getByText(/有几张没加进去/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "发出去" }))

    await waitFor(() => expect(submitFeedback).toHaveBeenCalledTimes(1))
    expect(vi.mocked(submitFeedback).mock.calls[0][1]).toHaveLength(3)
  })

  it("Esc 关掉，再打开是干净的表单", async () => {
    openDialog()
    fill("写了一半")

    fireEvent.keyDown(document, { key: "Escape" })
    await waitFor(() => expect(screen.queryByText("有事儿您说话")).not.toBeInTheDocument())

    fireEvent.click(screen.getByRole("button", { name: "问题反馈" }))
    expect(screen.getByPlaceholderText("一句话说清是啥事")).toHaveValue("")
  })
})
