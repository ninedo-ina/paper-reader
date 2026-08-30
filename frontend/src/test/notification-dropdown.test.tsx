import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { NextIntlClientProvider } from "next-intl"
import { NotificationDropdown } from "@/components/layout/NotificationDropdown"
import { VersionPopup } from "@/components/layout/VersionPopup"
import { useNotificationStore } from "@/stores/notification-store"
import { useAuthStore } from "@/stores/auth-store"
import zhMessages from "@/i18n/locales/zh/common.json"

const notification = {
  id: "version-info",
  type: "system" as const,
  title: "系统功能介绍",
  message: "欢迎使用 PaperHelper！点击查看当前版本功能特性",
  timestamp: Date.now(),
  read: false,
  actionKey: "version",
}

function renderDropdown() {
  return render(
    <NextIntlClientProvider locale="zh" messages={zhMessages}>
      <NotificationDropdown />
    </NextIntlClientProvider>,
  )
}

describe("version notification", () => {
  beforeEach(() => {
    localStorage.clear()
    useNotificationStore.setState({ notifications: [notification], showVersionPopup: false })
    useAuthStore.setState({ isNewUser: null })
  })

  afterEach(cleanup)

  it("opens the popup and marks the notification read when its content is clicked", () => {
    renderDropdown()
    fireEvent.click(screen.getByRole("button", { name: /通知/ }))
    fireEvent.click(screen.getByText(notification.title))

    expect(useNotificationStore.getState().notifications[0].read).toBe(true)
    expect(useNotificationStore.getState().showVersionPopup).toBe(true)
  })

  it("uses the same popup flow from the action button", () => {
    renderDropdown()
    fireEvent.click(screen.getByRole("button", { name: /通知/ }))
    fireEvent.click(screen.getByRole("button", { name: "查看版本功能" }))

    expect(useNotificationStore.getState().notifications[0].read).toBe(true)
    expect(useNotificationStore.getState().showVersionPopup).toBe(true)
    expect(screen.queryByText("查看版本功能")).not.toBeInTheDocument()
  })

  it("uses the active theme surface instead of the glass card", () => {
    useNotificationStore.setState({ showVersionPopup: true })
    const { container } = render(
      <NextIntlClientProvider locale="zh" messages={zhMessages}>
        <VersionPopup />
      </NextIntlClientProvider>,
    )
    const card = container.querySelector(".bg-\\[var\\(--surface-0\\)\\]")

    expect(card).toBeInTheDocument()
    expect(card).toHaveClass("text-[var(--text-primary)]")
    expect(card).not.toHaveClass("glass-surface")
  })
})
