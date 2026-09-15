import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ProfileDialog } from "@/components/settings/ProfileDialog"
import { useUserStore } from "@/stores/user-store"
import type { UserProfile } from "@/lib/api/types"

vi.mock("@/lib/api/auth", () => ({
  updateProfile: vi.fn().mockResolvedValue(undefined),
  changePassword: vi.fn(),
}))

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 8,
    email: "sunchengxing@example.com",
    displayName: null,
    avatarUrl: null,
    authProvider: "github",
    ...overrides,
  }
}

function renderDialog(overrides: Partial<UserProfile> = {}) {
  useUserStore.setState({ profile: profile(overrides), isLoading: false })
  return render(<ProfileDialog open onClose={() => {}} />)
}

/** 悬停才能看到「更换头像」按钮，点了才展开上传菜单 */
function openAvatarMenu() {
  fireEvent.mouseEnter(screen.getByTestId("profile-avatar"))
  fireEvent.click(screen.getByLabelText("更换头像"))
}

describe("personal center (REQ-202609-0110)", () => {
  beforeEach(() => {
    useUserStore.setState({ profile: null, isLoading: false })
  })
  afterEach(cleanup)

  it("shows the email next to the profile fields", () => {
    renderDialog()

    // 邮箱必须真的显示在个人中心里，空着就是缺陷
    expect(screen.getByDisplayValue("sunchengxing@example.com")).toBeInTheDocument()
  })

  it("shows the system generated name and a default avatar when nothing is set", () => {
    renderDialog()

    expect(screen.getAllByText("用户8").length).toBeGreaterThan(0)
    // 头像字符取邮箱首字母并大写，而不是一个问号
    expect(screen.getByText("S")).toBeInTheDocument()
    expect(screen.queryByText("?")).not.toBeInTheDocument()
    // 显示名称留空时用「用户8」做占位提示
    expect(screen.getByPlaceholderText("用户8")).toBeInTheDocument()
  })

  it("keeps the user's own name when they set one", () => {
    renderDialog({ displayName: "小明" })

    expect(screen.getAllByText("小明").length).toBeGreaterThan(0)
    // 头像字符按需求取邮箱首字母，跟用户名是谁无关
    expect(screen.getByText("S")).toBeInTheDocument()
  })

  it("closes the avatar menu when clicking an empty area", () => {
    renderDialog()
    openAvatarMenu()
    expect(screen.getByText("从本地上传")).toBeInTheDocument()

    fireEvent.mouseDown(document.body)

    expect(screen.queryByText("从本地上传")).not.toBeInTheDocument()
    expect(screen.queryByText("网络图片")).not.toBeInTheDocument()
  })

  it("closes the avatar menu on Escape", () => {
    renderDialog()
    openAvatarMenu()
    expect(screen.getByText("网络图片")).toBeInTheDocument()

    fireEvent.keyDown(document, { key: "Escape" })

    expect(screen.queryByText("网络图片")).not.toBeInTheDocument()
  })

  it("keeps the avatar menu open while clicking inside it", () => {
    renderDialog()
    openAvatarMenu()

    fireEvent.mouseDown(screen.getByText("网络图片"))

    expect(screen.getByText("网络图片")).toBeInTheDocument()
  })
})
