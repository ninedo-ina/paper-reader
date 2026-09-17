import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { TabBar, type TabDef } from "@/components/ui/TabBar"

// jsdom has no ResizeObserver; the indicator effect only needs the shape.
beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

const tabs: TabDef[] = [
  { key: "all", label: "全部", count: 128 },
  { key: "import", label: "导入", count: 3 },
  { key: "create", label: "创建", count: 0 },
  { key: "favorite", label: "收藏" },
]

function renderBar(activeKey = "all") {
  render(<TabBar tabs={tabs} activeKey={activeKey} onChange={vi.fn()} />)
}

describe("TabBar count badge", () => {
  afterEach(cleanup)

  it("keeps the data-tab-key hooks the panel relies on", () => {
    renderBar()
    for (const tab of tabs) {
      expect(document.querySelector(`[data-tab-key="${tab.key}"]`)).not.toBeNull()
    }
  })

  it("renders the count as an out-of-flow corner badge, not an inline flex sibling", () => {
    renderBar()

    const badge = screen.getByText("3")
    // Positioned at the label's top-end corner and removed from the flow, so it
    // cannot steal width from the label (which caused per-glyph CJK wrapping).
    expect(badge.classList.contains("absolute")).toBe(true)
    expect(badge.classList.contains("-top-2")).toBe(true)
    expect(badge.classList.contains("-end-2")).toBe(true)
    expect(badge.classList.contains("pointer-events-none")).toBe(true)
    expect(badge.getAttribute("aria-hidden")).toBe("true")
  })

  it("never lets the label wrap one glyph per line", () => {
    renderBar()

    // The label is truncating (nowrap + ellipsis) and is no longer a flex sibling
    // competing with the badge for the tab's width.
    const label = screen.getByText("全部")
    expect(label.classList.contains("truncate")).toBe(true)

    const button = document.querySelector('[data-tab-key="all"]') as HTMLElement
    expect(button.className).not.toContain("gap-1.5")
  })

  it("clamps counts above 99 and hides zero counts", () => {
    renderBar()

    expect(screen.getByText("99+")).toBeTruthy()
    expect(screen.queryByText("0")).toBeNull()
  })

  it("exposes the count to assistive tech through the button label", () => {
    renderBar()

    expect(screen.getByRole("button", { name: "全部 (99+)" })).toBeTruthy()
    // Tabs without a count keep their plain label.
    expect(screen.getByRole("button", { name: "收藏" })).toBeTruthy()
  })
})
