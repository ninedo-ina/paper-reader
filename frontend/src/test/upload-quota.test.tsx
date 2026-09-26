import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { UploadDialog } from "@/components/papers/UploadDialog"
import { withIntl } from "./intl"
import * as papersApi from "@/lib/api/papers"
import type { UploadQuotaDto } from "@/lib/api/types"

vi.mock("@/lib/api/papers")

const MB = 1024 * 1024

function quota(overrides: Partial<UploadQuotaDto> = {}): UploadQuotaDto {
  return {
    fileLimitBytes: 10 * MB,
    dailyLimitBytes: 100 * MB,
    totalLimitBytes: 200 * MB,
    dailyUsedBytes: 0,
    totalUsedBytes: 0,
    dailyRemainingBytes: 100 * MB,
    totalRemainingBytes: 200 * MB,
    ...overrides,
  }
}

/** 只关心大小，不真造 10MB 的字节：size 是判断依据。 */
function pdf(name: string, sizeBytes: number): File {
  const file = new File(["%PDF-1.7"], name, { type: "application/pdf" })
  Object.defineProperty(file, "size", { value: sizeBytes })
  return file
}

function renderDialog() {
  const onClose = vi.fn()
  const onUploaded = vi.fn()
  render(withIntl(<UploadDialog open onClose={onClose} onUploaded={onUploaded} />))
  return { onClose, onUploaded }
}

function pickFile(file: File) {
  // 文件输入是 hidden 的，直接对它发 change，和用户选文件的路径一致。
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [file] } })
}

describe("UploadDialog 上传限额", () => {
  beforeEach(() => {
    vi.mocked(papersApi.getUploadQuota).mockResolvedValue(quota())
    vi.mocked(papersApi.listPapers).mockResolvedValue({ items: [], total: 0, page: 0, pageSize: 20 })
    vi.mocked(papersApi.uploadPdf).mockResolvedValue({ id: 1 } as never)
    vi.mocked(papersApi.uploadFromUrl).mockResolvedValue({ id: 1 } as never)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("把单用户剩余额度显示出来", async () => {
    vi.mocked(papersApi.getUploadQuota).mockResolvedValue(
      quota({ dailyRemainingBytes: 60 * MB, totalRemainingBytes: 140 * MB }),
    )

    renderDialog()

    expect(await screen.findByText("今日剩余 60.0 MB，累计剩余 140.0 MB")).toBeInTheDocument()
    expect(screen.getByText("单个文件不超过 10.0 MB")).toBeInTheDocument()
  })

  it("超过 10MB 的文件在本地就被挡下，不发请求", async () => {
    renderDialog()
    await screen.findByText(/今日剩余/)

    pickFile(pdf("big.pdf", 11 * MB))

    expect(await screen.findByRole("alert")).toHaveTextContent("文件 11.0 MB 超过单文件上限 10.0 MB")
    expect(papersApi.uploadPdf).not.toHaveBeenCalled()
  })

  it("正好 10MB 的文件放行", async () => {
    const { onClose } = renderDialog()
    await screen.findByText(/今日剩余/)

    pickFile(pdf("limit.pdf", 10 * MB))

    expect(papersApi.uploadPdf).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it("服务端因为配额拒绝时把原话显示出来，弹窗不关", async () => {
    vi.mocked(papersApi.uploadPdf).mockRejectedValue(
      Object.assign(new Error("今日上传额度不足：单用户单日上限 100MB，今日已用 99MB"), { code: 1010 }),
    )
    const { onClose } = renderDialog()
    await screen.findByText(/今日剩余/)

    pickFile(pdf("fits.pdf", 2 * MB))

    expect(await screen.findByRole("alert")).toHaveTextContent("单用户单日上限 100MB")
    expect(onClose).not.toHaveBeenCalled()
  })

  it("URL 导入被拒时同样显示原因", async () => {
    vi.mocked(papersApi.uploadFromUrl).mockRejectedValue(
      new Error("文件大小 12.0MB 超过单文件上限 10MB"),
    )
    const { onClose } = renderDialog()
    await screen.findByText(/今日剩余/)

    fireEvent.click(screen.getByRole("button", { name: "URL" }))
    fireEvent.change(screen.getByLabelText("打开链接"), { target: { value: "https://example.com/paper.pdf" } })
    fireEvent.click(screen.getByRole("button", { name: "打开链接" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("超过单文件上限 10MB")
    expect(onClose).not.toHaveBeenCalled()
  })

  it("配额接口挂了就只少一行提示，不影响上传", async () => {
    vi.mocked(papersApi.getUploadQuota).mockRejectedValue(new Error("network"))
    const { onClose } = renderDialog()

    await screen.findByText("单个文件不超过 10.0 MB")
    expect(screen.queryByText(/今日剩余/)).not.toBeInTheDocument()

    pickFile(pdf("fits.pdf", 2 * MB))

    expect(papersApi.uploadPdf).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })
})
