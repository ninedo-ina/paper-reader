import { describe, expect, it } from "vitest"
import {
  avatarBackground,
  avatarForeground,
  avatarInitial,
  contrastRatio,
  defaultAvatar,
  defaultDisplayName,
} from "@/lib/user-display"

// REQ-202609-0110：登录后必须有默认头像（邮箱首字符 + 纯色底，对比度够）
// 和默认用户名（ID 不再露在界面上，改用「用户{id}」）。
describe("default avatar", () => {
  it("uses the first letter of the email, uppercased", () => {
    expect(avatarInitial("sunchengxing@example.com")).toBe("S")
    expect(avatarInitial("zoe@example.com")).toBe("Z")
  })

  it("keeps digits as-is and falls back to the name when there is no email", () => {
    expect(avatarInitial("7lucky@example.com")).toBe("7")
    expect(avatarInitial(null, "用户8")).toBe("用")
    expect(avatarInitial(undefined, undefined)).toBe("?")
  })

  it("picks a foreground colour that actually contrasts with the background", () => {
    for (const seed of ["a@b.com", "7lucky@example.com", "user@github.user", "我@例子.cn"]) {
      const avatar = defaultAvatar(seed)
      expect(avatar.background).toMatch(/^#[0-9a-f]{6}$/i)
      expect(contrastRatio(avatar.background, avatar.foreground)).toBeGreaterThanOrEqual(4.5)
      expect(avatar.foreground).not.toBe(avatar.background)
    }
  })

  it("gives the same user the same colour every time", () => {
    expect(avatarBackground("user@example.com")).toBe(avatarBackground("USER@example.com"))
    expect(defaultAvatar("user@example.com")).toEqual(defaultAvatar("user@example.com"))
  })

  it("never lets the text colour match the background", () => {
    // 白色和深墨两个候选里挑对比度高的；浅底不会配白字
    expect(avatarForeground("#ffffff")).toBe("#1f2933")
    expect(avatarForeground("#000000")).toBe("#ffffff")
  })
})

describe("default display name", () => {
  it("prefers the name the user set", () => {
    expect(defaultDisplayName({ id: 3, displayName: "小明", email: "a@b.com" })).toBe("小明")
  })

  it("falls back to 用户{id} instead of the email prefix", () => {
    expect(defaultDisplayName({ id: 8, displayName: null, email: "sunchengxing@example.com" })).toBe("用户8")
    expect(defaultDisplayName({ id: 12, displayName: "  ", email: null })).toBe("用户12")
  })

  it("still returns something for a profile that has not loaded yet", () => {
    expect(defaultDisplayName(null)).toBe("用户")
    expect(defaultDisplayName({ id: null, displayName: null, email: "abc@example.com" })).toBe("abc")
  })
})
