import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { withIntl } from "@/test/intl"
import { LanguagePicker } from "@/components/settings/LanguagePicker"

/**
 * 语言选择面板（登录页/顶栏的下拉 + 偏好设置里的语言网格）不显示滚动条，但仍然能滚。
 *
 * 面板本身有圆角和阴影，原生滚动条会贴着右边缘切进去，和圆角对不齐；
 * 但 14 种语言一定放不下，所以 overflow-y-auto 不能去掉，只是把滚动条本身藏起来。
 * 谁把 .scrollbar-hidden 去掉、或者顺手把 overflow-y-auto 一起删了，这里都会红。
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/zh/login",
}))

const { LanguageSwitcher } = await import("@/components/ui/LanguageSwitcher")

/** 逐个类名断言，避免 toHaveClass 的顺序/子串坑（scrollbar-hidden 与 overflow-y-auto 互不包含） */
function expectScrollableWithoutScrollbar(el: HTMLElement) {
  expect(el).toHaveClass("scrollbar-hidden")
  expect(el).toHaveClass("overflow-y-auto")
}

describe("语言面板的滚动条", () => {
  it("登录页的下拉列表能滚但不露滚动条", () => {
    render(withIntl(<LanguageSwitcher />))
    fireEvent.click(screen.getByRole("button", { name: "切换语言" }))

    expectScrollableWithoutScrollbar(screen.getByRole("listbox", { name: "语言" }))
  })

  it("偏好设置里的语言网格能滚但不露滚动条", () => {
    render(withIntl(<LanguagePicker value="zh" onSelect={() => {}} />))

    expectScrollableWithoutScrollbar(screen.getByRole("listbox", { name: "语言" }))
  })

  // jsdom 不加载样式表，光断言类名只能证明组件写了这个类，证明不了类真的有定义。
  // 这里直接读 globals.css，盯住三个内核各认的那一条声明 —— 少一条就有浏览器露滚动条。
  it("globals.css 里 .scrollbar-hidden 覆盖了三个内核", () => {
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8")
      .replace(/\s+/g, " ")

    expect(css).toContain(".scrollbar-hidden { scrollbar-width: none; -ms-overflow-style: none;")
    expect(css).toContain(".scrollbar-hidden::-webkit-scrollbar { width: 0; height: 0; display: none;")
  })
})
