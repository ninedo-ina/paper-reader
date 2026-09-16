import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { withIntl } from "@/test/intl"
import { QrCodeCard } from "@/components/settings/QrCodeCard"

// 二维码本体由 canvas 绘制，jsdom 里跑不了，这里只锁住「交给 qrcode 的配色」
// 和「外面那层卡片长什么样」——正是深色主题下那块突兀黑底的两个来源。
const toDataURL = vi.fn()

vi.mock("qrcode", () => ({
  default: { toDataURL: (...args: unknown[]) => toDataURL(...args) },
}))

describe("qr code card", () => {
  afterEach(() => {
    cleanup()
    toDataURL.mockReset()
  })

  it("asks for dark modules on a white background, whatever the theme", async () => {
    toDataURL.mockResolvedValue("data:image/png;base64,AAAA")
    render(withIntl(<QrCodeCard value="otpauth://totp/demo?secret=ABC" />))

    expect(await screen.findByAltText("两步验证二维码")).toBeTruthy()
    expect(toDataURL).toHaveBeenCalledTimes(1)

    const [value, options] = toDataURL.mock.calls[0]
    expect(value).toBe("otpauth://totp/demo?secret=ABC")
    expect(options.color).toEqual({ dark: "#1f2933", light: "#ffffff" })
    expect(options.errorCorrectionLevel).toBe("M")
    // 曾经深色主题会反相成 #101823 深底，那正是要拆掉的东西
    expect(JSON.stringify(options)).not.toContain("#101823")
  })

  it("wraps the code in a rounded white card instead of a bare dark block", async () => {
    toDataURL.mockResolvedValue("data:image/png;base64,AAAA")
    const { container } = render(withIntl(<QrCodeCard value="otpauth://totp/demo?secret=ABC" />))
    await screen.findByAltText("两步验证二维码")

    const card = container.firstElementChild as HTMLElement
    expect(card.className).toContain("rounded-2xl")
    expect(card.className).toContain("bg-white")
    expect(card.className).toContain("border")

    // 内层是方正的浅色静默区：不能被圆角裁掉，否则影响识别
    const plate = card.firstElementChild as HTMLElement
    expect(plate.className).not.toContain("rounded")
    expect(plate.className).not.toContain("overflow-hidden")
    expect(plate.style.background).toBe("rgb(255, 255, 255)")
  })

  it("points at the manual key when the code cannot be generated", async () => {
    toDataURL.mockRejectedValue(new Error("boom"))
    render(withIntl(<QrCodeCard value="otpauth://totp/demo?secret=ABC" />))

    expect(await screen.findByText(/二维码生成失败/)).toBeTruthy()
    expect(screen.queryByAltText("两步验证二维码")).toBeNull()
  })
})
