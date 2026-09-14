// =============================================================================
// 设备标识 — 保存在本机，用于「信任设备」列表与免二次验证
// =============================================================================

const DEVICE_KEY_STORAGE = "pr_device_id"
const DEVICE_NAME_STORAGE = "pr_device_name"

/** 生成一个随机设备标识（优先用 crypto.randomUUID）。 */
function createDeviceKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  const bytes = new Uint8Array(16)
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

/**
 * 本机稳定不变的设备标识。登录接口会带上它，后端据此判断该设备是否已信任，
 * 以及在「信任设备」页面里把这条记录标成「当前设备」。
 */
export function getDeviceId(): string | null {
  if (typeof window === "undefined") return null
  try {
    const existing = localStorage.getItem(DEVICE_KEY_STORAGE)
    if (existing) return existing
    const key = createDeviceKey()
    localStorage.setItem(DEVICE_KEY_STORAGE, key)
    return key
  } catch {
    // 隐私模式等禁用 localStorage 的场景：退化成一次性标识
    return createDeviceKey()
  }
}

/** 展示用的设备名，取不到时返回 null，由后端按 UA 兜底。 */
export function getDeviceName(): string | null {
  if (typeof window === "undefined") return null
  try {
    const saved = localStorage.getItem(DEVICE_NAME_STORAGE)
    if (saved) return saved
    const name = describeUserAgent(navigator.userAgent)
    localStorage.setItem(DEVICE_NAME_STORAGE, name)
    return name
  } catch {
    return null
  }
}

function describeUserAgent(ua: string): string {
  const platform = /iPhone|iPad|iPod/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Macintosh|Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : ""
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "浏览器"
  return platform ? `${platform} · ${browser}` : browser
}
