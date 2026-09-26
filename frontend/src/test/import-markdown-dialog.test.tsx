import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ImportMarkdownDialog } from "@/components/papers/ImportMarkdownDialog"
import { withIntl } from "./intl"

function renderDialog(onSubmit: (md: string) => Promise<void>) {
  const onClose = vi.fn()
  render(withIntl(<ImportMarkdownDialog open onClose={onClose} onSubmit={onSubmit} />))
  return { onClose }
}

function textarea() {
  return screen.getByPlaceholderText(/Markdown/i) as HTMLTextAreaElement
}

describe("ImportMarkdownDialog Markdown 导入弹层", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("正文为空时预览按钮禁用", () => {
    renderDialog(vi.fn().mockResolvedValue(undefined))
    expect(screen.getByRole("button", { name: "预览导入" })).toBeDisabled()
  })

  it("输入后预览把 Markdown 交给上层并在成功后关闭", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const { onClose } = renderDialog(onSubmit)

    fireEvent.change(textarea(), { target: { value: "# Hello" } })
    fireEvent.click(screen.getByRole("button", { name: "预览导入" }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("# Hello"))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it("上层转换失败时显示原因且不关闭", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Markdown 解析失败"))
    const { onClose } = renderDialog(onSubmit)

    fireEvent.change(textarea(), { target: { value: "# Bad" } })
    fireEvent.click(screen.getByRole("button", { name: "预览导入" }))

    expect(await screen.findByText("Markdown 解析失败")).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it("选择 .md 文件后把内容填进文本框", async () => {
    renderDialog(vi.fn().mockResolvedValue(undefined))

    // jsdom 的 File 没实现 Blob.text()，这里补上，测的是组件把读到的文本灌进文本框这段逻辑
    const file = new File(["# From file"], "paper.md", { type: "text/markdown" })
    Object.defineProperty(file, "text", { value: () => Promise.resolve("# From file") })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(textarea().value).toBe("# From file"))
  })
})
