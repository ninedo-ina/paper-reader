// =============================================================================
// 用户展示兜底 — 默认头像与默认用户名
//
// REQ-202609-0110：用户没有上传头像时，不能只显示一个问号，也不该直接把邮箱
// 前缀当作用户名。这里集中生成两样东西：
//   1. 默认头像：取邮箱首字符（英文字母转大写）+ 由邮箱推导的纯色底，
//      文字颜色按对比度在白/深墨之间二选一，保证看得清。
//   2. 默认用户名：ID 不再展示在界面上，于是用「用户{id}」补一个稳定的名字。
// =============================================================================

export interface DefaultAvatar {
  /** 头像上显示的字符 */
  initial: string
  /** 纯色底 */
  background: string
  /** 与底色对比度足够的文字颜色 */
  foreground: string
}

/**
 * 头像底色候选。都是中等偏深的颜色，配白字对比度足够；
 * 具体取哪个由邮箱哈希决定，所以同一个用户每次看到的颜色都一样。
 */
const AVATAR_COLORS = [
  "#2f6f9f",
  "#2f7d6f",
  "#3d7a4f",
  "#8a5a2f",
  "#8a4b2f",
  "#7a3f5f",
  "#4f4f9f",
  "#6f4f9f",
  "#2f5f7a",
  "#6b6b2f",
  "#8a3f4f",
  "#3f6b8a",
]

const LIGHT_INK = "#ffffff"
const DARK_INK = "#1f2933"

/** WCAG 2.1 相对亮度 */
function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  const [r, g, b] = channels
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** 两个颜色的对比度，用来确认文字不会被底色吃掉 */
export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (lighter + 0.05) / (darker + 0.05)
}

/** 底色定了，文字在白和深墨里挑对比度更高的那个 */
export function avatarForeground(background: string): string {
  return contrastRatio(background, LIGHT_INK) >= contrastRatio(background, DARK_INK)
    ? LIGHT_INK
    : DARK_INK
}

/**
 * 头像字符：优先取邮箱的第一个字符（需求要求按邮箱来），
 * 邮箱缺失时退回用户名。英文大写，中文和数字原样保留。
 */
export function avatarInitial(...sources: (string | null | undefined)[]): string {
  for (const source of sources) {
    const first = source?.trim().charAt(0)
    if (!first) continue
    return /[a-zA-Z]/.test(first) ? first.toUpperCase() : first
  }
  return "?"
}

/** 同一个种子永远得到同一个底色 */
export function avatarBackground(seed: string): string {
  let hash = 0
  for (const char of seed.trim().toLowerCase()) {
    hash = (hash * 31 + char.codePointAt(0)!) >>> 0
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

/** 生成默认头像：字符取自邮箱首字符，底色由邮箱决定 */
export function defaultAvatar(
  email?: string | null,
  name?: string | null,
): DefaultAvatar {
  const background = avatarBackground(email || name || "paperhelper")
  return {
    initial: avatarInitial(email, name),
    background,
    foreground: avatarForeground(background),
  }
}

interface DisplayNameSource {
  id?: number | null
  displayName?: string | null
  email?: string | null
}

/**
 * 用户名兜底：用户自己设过就用他自己的，否则用「用户{id}」这个系统生成的名字。
 * 邮箱前缀不再直接当用户名，避免把邮箱暴露在界面上。
 */
export function defaultDisplayName(profile?: DisplayNameSource | null): string {
  const name = profile?.displayName?.trim()
  if (name) return name
  if (profile?.id) return `用户${profile.id}`
  return profile?.email?.split("@")[0]?.trim() || "用户"
}
