import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { getDeviceId, getDeviceName } from "@/lib/device"

// REQ-202609-0104: the device key has to stay stable on a machine, because
// the trusted-device list, the "current device" badge and the trusted skip
// of 2FA all key off it.
describe("device identity", () => {
  const originalUserAgent = navigator.userAgent

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    Object.defineProperty(navigator, "userAgent", { value: originalUserAgent, configurable: true })
  })

  function setUserAgent(ua: string) {
    Object.defineProperty(navigator, "userAgent", { value: ua, configurable: true })
  }

  it("returns the same device id across calls and persists it", () => {
    const first = getDeviceId()
    expect(first).toBeTruthy()
    expect(getDeviceId()).toBe(first)
    expect(localStorage.getItem("pr_device_id")).toBe(first)
  })

  it("prefers an already stored device id", () => {
    localStorage.setItem("pr_device_id", "stored-device-key")
    expect(getDeviceId()).toBe("stored-device-key")
  })

  it("derives a readable device name from the user agent", () => {
    setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    )
    expect(getDeviceName()).toBe("macOS · Chrome")

    localStorage.clear()
    setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Edg/140.0")
    expect(getDeviceName()).toBe("Windows · Edge")
  })
})
