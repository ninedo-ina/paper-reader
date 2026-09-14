import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TwoFactorTab } from "@/components/settings/TwoFactorTab"
import * as securityApi from "@/lib/api/security"
import type { TwoFactorSetup, TwoFactorStatus } from "@/lib/api/types"

// 二维码走 canvas，测不了也不该拖慢用例；这里只关心密钥和表单本身。
vi.mock("@/components/settings/ThemeAwareQrCode", () => ({ ThemeAwareQrCode: () => null }))
vi.mock("@/lib/api/security", () => ({
  getTwoFactorStatus: vi.fn(),
  setupTwoFactor: vi.fn(),
  enableTwoFactor: vi.fn(),
  disableTwoFactor: vi.fn(),
  regenerateRecoveryCodes: vi.fn(),
  getTrustedDevices: vi.fn(),
  deleteTrustedDevices: vi.fn(),
}))

const STATUS: TwoFactorStatus = { enabled: false, recoveryCodesRemaining: 0, recoveryCodesTotal: 9 }
const SETUP: TwoFactorSetup = {
  secret: "JBSWY3DPEHPK3PXP",
  otpauthUri: "otpauth://totp/paper:reader@example.com?secret=JBSWY3DPEHPK3PXP",
  digits: 6,
  period: 30,
}

/** 打开绑定向导，返回后就已经停在表单上 */
async function openBindWizard() {
  render(<TwoFactorTab />)
  fireEvent.click(await screen.findByRole("button", { name: /扫码绑定并开启/ }))
  await screen.findByText(SETUP.secret)
}

describe("two-factor setup form", () => {
  beforeEach(() => {
    vi.mocked(securityApi.getTwoFactorStatus).mockResolvedValue(STATUS)
    vi.mocked(securityApi.setupTwoFactor).mockResolvedValue(SETUP)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("copies the manually typed secret from its own button", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    await openBindWizard()
    fireEvent.click(screen.getByRole("button", { name: /复制/ }))

    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(SETUP.secret))
  })

  it("puts the label and the field on one line with a real gap between them", async () => {
    await openBindWizard()

    for (const [label, fieldId] of [
      ["当前密码", "two-factor-password"],
      ["6 位动态码", "two-factor-code"],
    ] as const) {
      const labelElement = screen.getByText(label)
      const row = labelElement.parentElement!
      const field = document.getElementById(fieldId)!

      // 左右两栏，中间留出间距；窄屏才堆叠
      expect(row.className).toContain("sm:flex-row")
      expect(row.className).toContain("sm:gap-6")
      expect(labelElement.className).toContain("sm:w-24")
      // 标签与输入框是同一行的两个子节点，而不是上下紧贴
      expect(row.children).toHaveLength(2)
      expect(row.children[0]).toBe(labelElement)
      expect(row.children[1].contains(field)).toBe(true)
    }
  })

  it("feeds the digits typed into the cells into the enable request", async () => {
    vi.mocked(securityApi.enableTwoFactor).mockResolvedValue({ recoveryCodes: ["000001"] })
    await openBindWizard()

    fireEvent.change(document.getElementById("two-factor-password")!, { target: { value: "s3cret" } })
    fireEvent.change(screen.getByLabelText("动态码第 1 位"), { target: { value: "123456" } })
    // 提交里有一串 await，用 act 包住让随后的 setState 都落在同一次 flush 里
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /确认开启/ }))
    })

    expect(securityApi.enableTwoFactor).toHaveBeenCalledWith({ password: "s3cret", code: "123456" })
    // 开启成功后直接进入恢复码面板
    expect(await screen.findByText(/共 1 个恢复码/)).toBeInTheDocument()
  })
})
