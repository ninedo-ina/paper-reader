import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { withIntl } from "@/test/intl"
import { LOCALES, LOCALE_META } from "@/i18n/locales"
import { useAuthStore } from "@/stores/auth-store"

/**
 * 需求里点名的那处：登录页的语言切换以前点了没反应，现在要弹出下拉列表。
 * 这里锁住「弹列表 → 选语言 → 走整页跳转（不是软导航）」这条链路。
 */

const applyLocale = vi.fn()
const saveLocalePreference = vi.fn().mockResolvedValue(true)

vi.mock("next/navigation", () => ({
  usePathname: () => "/zh/login",
}))

vi.mock("@/i18n/switch-locale", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n/switch-locale")>()
  return {
    ...actual,
    applyLocale: (...args: Parameters<typeof actual.applyLocale>) => applyLocale(...args),
  }
})

vi.mock("@/i18n/locale-preference", () => ({
  saveLocalePreference: (...args: unknown[]) => saveLocalePreference(...args),
}))

const { LanguageSwitcher } = await import("@/components/ui/LanguageSwitcher")

function openSwitcher() {
  render(withIntl(<LanguageSwitcher />))
  fireEvent.click(screen.getByRole("button", { name: "切换语言" }))
}

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    applyLocale.mockClear()
    saveLocalePreference.mockClear()
    useAuthStore.setState({ accessToken: null })
  })

  it("点击后弹出完整语言列表", () => {
    openSwitcher()

    const options = screen.getAllByRole("option")
    expect(options).toHaveLength(LOCALES.length)
    // 选项顺序与 LOCALES 一致，每项都带本语言名与英文名
    options.forEach((option, i) => {
      expect(option).toHaveTextContent(LOCALE_META[LOCALES[i]].nativeName)
      expect(option).toHaveTextContent(LOCALE_META[LOCALES[i]].englishName)
    })
  })

  it("当前语言标记为已选中", () => {
    openSwitcher()

    const current = screen.getByRole("option", { name: new RegExp(LOCALE_META.zh.nativeName) })
    expect(current).toHaveAttribute("aria-selected", "true")
  })

  it("选中其它语言后整页跳到同一页面的新语言地址", () => {
    openSwitcher()

    fireEvent.click(screen.getByRole("option", { name: new RegExp(LOCALE_META.ar.nativeName) }))

    expect(applyLocale).toHaveBeenCalledTimes(1)
    expect(applyLocale.mock.calls[0][0]).toBe("ar")
    expect(applyLocale.mock.calls[0][1]).toBe("/zh/login")
  })

  it("未登录时不写账号偏好", () => {
    openSwitcher()

    fireEvent.click(screen.getByRole("option", { name: new RegExp(LOCALE_META.ja.nativeName) }))

    expect(saveLocalePreference).not.toHaveBeenCalled()
  })

  it("已登录时把语言写回用户偏好设置", () => {
    useAuthStore.setState({ accessToken: "token" })
    openSwitcher()

    fireEvent.click(screen.getByRole("option", { name: new RegExp(LOCALE_META.fa.nativeName) }))

    expect(saveLocalePreference).toHaveBeenCalledWith("fa")
  })

  it("重新选中当前语言不触发跳转", () => {
    openSwitcher()

    fireEvent.click(screen.getByRole("option", { name: new RegExp(LOCALE_META.zh.nativeName) }))

    expect(applyLocale).not.toHaveBeenCalled()
  })
})
