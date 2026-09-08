import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { NextIntlClientProvider } from "next-intl"
import { DeletePaperDialog } from "@/components/papers/DeletePaperDialog"
import zhMessages from "@/i18n/locales/zh/common.json"
import type { AbstractIntlMessages } from "next-intl"

function renderDialog(onConfirm = vi.fn().mockResolvedValue(undefined)) {
  const onClose = vi.fn()
  render(
    <NextIntlClientProvider locale="zh" messages={zhMessages as unknown as AbstractIntlMessages}>
      <DeletePaperDialog
        open
        paperTitle="Attention Is All You Need"
        hasOriginalFile
        onClose={onClose}
        onConfirm={onConfirm}
      />
    </NextIntlClientProvider>,
  )
  return { onClose, onConfirm }
}

describe("DeletePaperDialog", () => {
  afterEach(cleanup)

  it("keeps the original file by default and requires explicit confirmation", async () => {
    const { onConfirm, onClose } = renderDialog()

    expect(screen.getByRole("dialog")).toHaveTextContent("Attention Is All You Need")
    expect(screen.getByRole("checkbox", { name: /同时删除原文件/ })).not.toBeChecked()

    fireEvent.click(screen.getByRole("button", { name: "删除" }))

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(false))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("passes the physical-file choice only after the checkbox is selected", async () => {
    const { onConfirm } = renderDialog()

    fireEvent.click(screen.getByRole("checkbox", { name: /同时删除原文件/ }))
    expect(screen.getByText(/服务器将不会保留此文件副本/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "删除" }))

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(true))
  })

  it("keeps the dialog open and displays a deletion error", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("存储服务不可用"))
    const { onClose } = renderDialog(onConfirm)

    fireEvent.click(screen.getByRole("button", { name: "删除" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("存储服务不可用")
    expect(onClose).not.toHaveBeenCalled()
  })
})
