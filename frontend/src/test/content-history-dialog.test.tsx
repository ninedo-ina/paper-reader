import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { JSONContent } from "@tiptap/react"
import { withIntl } from "@/test/intl"
import type {
  ContentSnapshotDetailDto,
  ContentSnapshotSummaryDto,
  PaperContentDto,
} from "@/lib/api/types"

const mocks = vi.hoisted(() => ({
  listContentSnapshots: vi.fn(),
  getContentSnapshot: vi.fn(),
  createContentSnapshot: vi.fn(),
  renameContentSnapshot: vi.fn(),
  restoreContentSnapshot: vi.fn(),
}))

vi.mock("@/lib/api/contentVersions", () => mocks)

import { ContentHistoryDialog } from "@/components/papers/PaperEditor/ContentHistoryDialog"

const body = (text: string): JSONContent => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
})

const currentBody = body("当前正文")
const oldBody = body("旧正文")

function summary(overrides: Partial<ContentSnapshotSummaryDto> = {}): ContentSnapshotSummaryDto {
  return {
    id: 11,
    paperId: 7,
    label: "初稿",
    source: "MANUAL",
    contentVersion: 3,
    createdAt: "2026-09-20T10:00:00Z",
    ...overrides,
  }
}

function detail(overrides: Partial<ContentSnapshotDetailDto> = {}): ContentSnapshotDetailDto {
  return {
    ...summary(),
    contentJson: oldBody,
    contentHtml: "<p>旧正文</p>",
    ...overrides,
  }
}

function renderDialog(overrides: { dirty?: boolean } = {}) {
  const onClose = vi.fn()
  const onRestored = vi.fn()
  render(
    withIntl(
      <ContentHistoryDialog
        open
        onClose={onClose}
        paperId={7}
        getCurrentContent={() => currentBody}
        dirty={overrides.dirty ?? false}
        onRestored={onRestored}
      />,
    ),
  )
  return { onClose, onRestored }
}

describe("正文版本历史", () => {
  beforeEach(() => {
    mocks.listContentSnapshots.mockResolvedValue([summary()])
    mocks.getContentSnapshot.mockResolvedValue(detail())
    mocks.createContentSnapshot.mockResolvedValue(summary({ id: 12, label: null, contentVersion: 4 }))
    mocks.renameContentSnapshot.mockResolvedValue(summary({ label: "投稿版" }))
    mocks.restoreContentSnapshot.mockResolvedValue({
      paperId: 7,
      contentJson: oldBody,
      contentHtml: "<p>旧正文</p>",
      contentVersion: 5,
      updatedAt: "2026-09-27T00:00:00Z",
    } satisfies PaperContentDto)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("打开时按时间线拉出这条论文的快照", async () => {
    renderDialog()

    expect(await screen.findByText("初稿")).toBeInTheDocument()
    expect(mocks.listContentSnapshots).toHaveBeenCalledWith(7)
    // 回滚前自动产生的快照和手动快照在界面上要能区分开
    expect(screen.getByText("手动保存")).toBeInTheDocument()
  })

  it("没有快照时给出下一步该做什么，而不是一片空白", async () => {
    mocks.listContentSnapshots.mockResolvedValue([])

    renderDialog()

    expect(await screen.findByText(/还没有快照/)).toBeInTheDocument()
  })

  it("拉取失败时明说失败，不假装没有快照", async () => {
    mocks.listContentSnapshots.mockRejectedValue(new Error("网络不可用"))

    renderDialog()

    expect(await screen.findByText("版本历史加载失败")).toBeInTheDocument()
    expect(screen.queryByText(/还没有快照/)).not.toBeInTheDocument()
  })

  it("存为快照时带上标签，并把新快照插到时间线最前面", async () => {
    renderDialog()
    await screen.findByText("初稿")

    fireEvent.change(screen.getByLabelText("标签（如：初稿、投稿版）"), {
      target: { value: "投稿版" },
    })
    fireEvent.click(screen.getByRole("button", { name: /存为快照/ }))

    await waitFor(() => expect(mocks.createContentSnapshot).toHaveBeenCalledWith(7, { label: "投稿版" }))
    expect(await screen.findByText("快照已保存")).toBeInTheDocument()
  })

  it("标签留空时发 null，让后端存成未命名而不是空字符串", async () => {
    renderDialog()
    await screen.findByText("初稿")

    fireEvent.click(screen.getByRole("button", { name: /存为快照/ }))

    await waitFor(() => expect(mocks.createContentSnapshot).toHaveBeenCalledWith(7, { label: null }))
  })

  it("可以改掉已有快照的标签", async () => {
    renderDialog()
    await screen.findByText("初稿")

    fireEvent.click(screen.getByRole("button", { name: /改标签/ }))
    fireEvent.change(screen.getByLabelText("标签"), { target: { value: "投稿版" } })
    fireEvent.click(screen.getByRole("button", { name: /保存标签/ }))

    await waitFor(() =>
      expect(mocks.renameContentSnapshot).toHaveBeenCalledWith(7, 11, { label: "投稿版" }),
    )
    expect(await screen.findByText("投稿版")).toBeInTheDocument()
  })

  it("预览展示这条快照当时的正文", async () => {
    renderDialog()
    await screen.findByText("初稿")

    fireEvent.click(screen.getByRole("button", { name: /预览/ }))

    await waitFor(() => expect(mocks.getContentSnapshot).toHaveBeenCalledWith(7, 11))
    expect(await screen.findByText("旧正文")).toBeInTheDocument()
  })

  it("回滚前先确认，并把覆盖后的正文交回上层", async () => {
    const { onRestored } = renderDialog()
    await screen.findByText("初稿")

    fireEvent.click(screen.getByRole("button", { name: /回滚到此版本/ }))
    // 确认前不发请求
    expect(mocks.restoreContentSnapshot).not.toHaveBeenCalled()
    expect(screen.getByText(/回滚前的正文会自动存为一条新快照/)).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole("button", { name: /回滚到此版本/ })[1])

    await waitFor(() => expect(mocks.restoreContentSnapshot).toHaveBeenCalledWith(7, 11, {}))
    expect(onRestored).toHaveBeenCalledWith(
      expect.objectContaining({ contentVersion: 5, contentJson: oldBody }),
    )
  })

  it("有未保存改动时不许回滚，并说明为什么", async () => {
    renderDialog({ dirty: true })
    await screen.findByText("初稿")

    const restore = screen.getByRole("button", { name: /回滚到此版本/ })
    expect(restore).toBeDisabled()
    expect(screen.getByText(/有未保存的改动/)).toBeInTheDocument()

    fireEvent.click(restore)
    expect(mocks.restoreContentSnapshot).not.toHaveBeenCalled()
  })

  it("回滚撞上版本冲突时提示先加载最新，而不是笼统的失败", async () => {
    mocks.restoreContentSnapshot.mockRejectedValue(
      Object.assign(new Error("正文已被其他会话更新"), { code: 1008 }),
    )

    renderDialog()
    await screen.findByText("初稿")

    fireEvent.click(screen.getByRole("button", { name: /回滚到此版本/ }))
    fireEvent.click(screen.getAllByRole("button", { name: /回滚到此版本/ })[1])

    expect(await screen.findByText(/请先「加载最新」再回滚/)).toBeInTheDocument()
  })

  it("对比默认拿当前正文跟最新快照比，逐行标出增删", async () => {
    renderDialog()
    await screen.findByText("初稿")

    // 左侧固定「当前正文」、右侧默认选中第一条快照，无需再点「对比」
    await waitFor(() => expect(mocks.getContentSnapshot).toHaveBeenCalledWith(7, 11))
    expect(await screen.findByText(/- 当前正文/)).toBeInTheDocument()
    expect(screen.getByText(/\+ 旧正文/)).toBeInTheDocument()
    expect(screen.getByText(/新增 1 行/)).toBeInTheDocument()
    expect(screen.getByText(/删除 1 行/)).toBeInTheDocument()
  })

  it("两侧选同一个版本时不去请求正文，也不谎报「一致」", async () => {
    renderDialog()
    await screen.findByText("初稿")
    vi.clearAllMocks()

    fireEvent.change(screen.getByLabelText("左侧"), { target: { value: "current" } })
    fireEvent.change(screen.getByLabelText("右侧"), { target: { value: "current" } })

    expect(await screen.findByText("选择两个版本进行对比")).toBeInTheDocument()
    expect(mocks.getContentSnapshot).not.toHaveBeenCalled()
  })
})
