import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { withIntl } from "@/test/intl"
import { RecoveryCodesPanel } from "@/components/settings/RecoveryCodesPanel"

// REQ-202609-0104: nine 6-digit codes, saved by copy or by a plain .txt
// download — never a PDF.
const CODES = [
  "104382", "560917", "238044", "771205", "409138",
  "652790", "813426", "097651", "325068",
]

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

describe("recovery codes panel", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("renders all nine six-digit codes", () => {
    render(withIntl(<RecoveryCodesPanel codes={CODES} />))

    for (const code of CODES) {
      expect(screen.getByText(code)).toBeInTheDocument()
    }
    expect(screen.getByText(/共 9 个恢复码/)).toBeInTheDocument()
    expect(CODES.every((code) => /^\d{6}$/.test(code))).toBe(true)
  })

  it("copies every code to the clipboard at once", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    render(withIntl(<RecoveryCodesPanel codes={CODES} />))
    fireEvent.click(screen.getByRole("button", { name: /一键复制/ }))

    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    expect(writeText.mock.calls[0][0].split("\n")).toEqual(CODES)
  })

  it("downloads a .txt file and never a pdf", async () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:codes")
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    // Capture the anchor the component actually clicked. `mock.instances` is
    // typed `void` here because the implementation returns nothing, so record
    // the receiver through `this` instead of casting it away.
    const clicked: HTMLAnchorElement[] = []
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this)
    })

    render(withIntl(<RecoveryCodesPanel codes={CODES} email="reader@example.com" />))
    fireEvent.click(screen.getByRole("button", { name: /下载 TXT 文件/ }))

    expect(clicked).toHaveLength(1)
    const anchor = clicked[0]
    expect(anchor.download.endsWith(".txt")).toBe(true)
    expect(anchor.download.toLowerCase()).not.toContain("pdf")

    // jsdom's Blob has no .text(), so read it back through FileReader
    const blob = createObjectURL.mock.calls[0][0] as Blob
    const text = await readBlob(blob)
    expect(blob.type).toContain("text/plain")
    expect(text).toContain("reader@example.com")
    for (const code of CODES) {
      expect(text).toContain(code)
    }
  })
})
