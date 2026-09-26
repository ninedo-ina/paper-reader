import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ExportDialog } from "@/components/papers/ExportDialog"
import { withIntl } from "./intl"
import * as exportApi from "@/lib/api/export"
import * as versionsApi from "@/lib/api/versions"
import type { ExportArtifactDto, ExportCapabilitiesDto, PaperVersionDto } from "@/lib/api/types"

vi.mock("@/lib/api/export")
vi.mock("@/lib/api/versions")

function caps(overrides: Partial<ExportCapabilitiesDto> = {}): ExportCapabilitiesDto {
  return {
    importAvailable: true,
    formats: [
      { id: "markdown", ext: "md", available: true },
      { id: "pdf", ext: "pdf", available: true },
      { id: "docx", ext: "docx", available: false },
    ],
    ...overrides,
  }
}

function artifact(overrides: Partial<ExportArtifactDto> = {}): ExportArtifactDto {
  return {
    id: 11,
    paperId: 1,
    versionId: null,
    format: "pdf",
    engine: "typst",
    byteSize: 2048,
    contentVersion: 3,
    status: "success",
    downloadUrl: "/api/papers/1/export/artifacts/11/download",
    createdAt: "2026-09-26T00:00:00Z",
    ...overrides,
  }
}

function version(overrides: Partial<PaperVersionDto> = {}): PaperVersionDto {
  return {
    id: 5,
    paperId: 1,
    version: "1",
    remark: "first cut",
    storagePushStatus: "success",
    createdAt: "2026-09-20T00:00:00Z",
    ...overrides,
  }
}

function renderDialog(props: Partial<Parameters<typeof ExportDialog>[0]> = {}) {
  const onClose = vi.fn()
  render(
    withIntl(
      <ExportDialog open paperId={1} paperTitle="Test Paper" onClose={onClose} {...props} />,
    ),
  )
  return { onClose }
}

describe("ExportDialog 导出弹层", () => {
  beforeEach(() => {
    vi.mocked(exportApi.getExportCapabilities).mockResolvedValue(caps())
    vi.mocked(exportApi.listExportArtifacts).mockResolvedValue([])
    vi.mocked(exportApi.createExport).mockResolvedValue(artifact())
    vi.mocked(exportApi.downloadExportArtifact).mockResolvedValue(undefined)
    vi.mocked(versionsApi.listVersions).mockResolvedValue([version()])
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("默认选中第一个可用格式，缺引擎的格式禁用", async () => {
    renderDialog()

    const markdownBtn = await screen.findByRole("button", { name: "Markdown" })
    expect(markdownBtn).toHaveAttribute("aria-pressed", "true")

    const docxBtn = screen.getByRole("button", { name: /Word/ })
    expect(docxBtn).toBeDisabled()
  })

  it("生成按选中的格式与范围调接口并触发下载", async () => {
    renderDialog()
    await screen.findByRole("button", { name: "Markdown" })

    fireEvent.click(screen.getByRole("button", { name: "PDF" }))
    fireEvent.click(screen.getByRole("button", { name: "生成并下载" }))

    await waitFor(() =>
      expect(exportApi.createExport).toHaveBeenCalledWith(1, { format: "pdf", versionId: undefined }),
    )
    expect(exportApi.downloadExportArtifact).toHaveBeenCalledWith(1, 11, "Test Paper.pdf")
  })

  it("预选版本时把版本带进导出请求", async () => {
    renderDialog({ defaultVersionId: 5 })
    await screen.findByRole("button", { name: "Markdown" })

    fireEvent.click(screen.getByRole("button", { name: "生成并下载" }))

    await waitFor(() =>
      expect(exportApi.createExport).toHaveBeenCalledWith(1, { format: "markdown", versionId: 5 }),
    )
  })

  it("生成失败时把服务端原话显示出来，不触发下载", async () => {
    vi.mocked(exportApi.createExport).mockRejectedValue(new Error("导出服务繁忙，请稍后重试"))
    renderDialog()
    await screen.findByRole("button", { name: "Markdown" })

    fireEvent.click(screen.getByRole("button", { name: "生成并下载" }))

    expect(await screen.findByText("导出服务繁忙，请稍后重试")).toBeInTheDocument()
    expect(exportApi.downloadExportArtifact).not.toHaveBeenCalled()
  })

  it("历史产物可二次下载", async () => {
    vi.mocked(exportApi.listExportArtifacts).mockResolvedValue([artifact({ id: 99, format: "docx" })])
    renderDialog()

    const downloadBtn = await screen.findByRole("button", { name: "下载" })
    fireEvent.click(downloadBtn)

    await waitFor(() =>
      expect(exportApi.downloadExportArtifact).toHaveBeenCalledWith(1, 99, "Test Paper.docx"),
    )
  })
})
