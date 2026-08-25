import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { NextIntlClientProvider } from "next-intl"
import { PaperCard } from "@/components/papers/PaperCard"
import type { PaperListDto } from "@/lib/api/types"
import zhMessages from "@/i18n/locales/zh/common.json"

const paper: PaperListDto = {
  id: 7,
  title: "Attention Is All You Need",
  authors: "Ashish Vaswani",
  journal: "NeurIPS",
  year: 2017,
  category: "JOURNAL",
  sourceType: "UPLOAD",
  hasOriginalFile: true,
  pageCount: 15,
  favorite: false,
  tags: ["Transformer"],
  createdAt: "2026-08-25T00:00:00Z",
}

describe("PaperCard actions", () => {
  afterEach(cleanup)

  it("exposes a separate more-actions control and invokes delete from its menu", () => {
    const onDelete = vi.fn()
    render(
      <NextIntlClientProvider locale="zh" messages={zhMessages}>
        <PaperCard paper={paper} onDelete={onDelete} />
      </NextIntlClientProvider>,
    )

    const actionsButton = screen.getByRole("button", { name: "更多操作" })
    expect(actionsButton.closest(".grid")).not.toBeNull()

    fireEvent.click(actionsButton)
    fireEvent.click(screen.getByRole("button", { name: "删除" }))

    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
