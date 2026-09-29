import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AbstractIntlMessages } from "next-intl"
import { setRuntimeLocale } from "@/i18n/runtime"
import { request } from "@/lib/api/client"
import enMessages from "@/i18n/locales/en/common.json"

/**
 * URL 导入失败的两个业务码是后端本轮新加的（1017 链接返回的不是 PDF、1018 压根没下下来）。
 * 它们的服务端 message 是中文写死的，前端若不映射，英文/日文界面上就会蹦出一句中文。
 * 这里按「界面是英文」跑一遍，钉住映射真的接上了——locale-coverage 只保证键存在，
 * 不保证 client.ts 的 switch 认得这两个码。
 */
const pdfBody = { code: 1017, message: "该链接返回的不是 PDF 文件，请使用论文的 PDF 直链" }
const downloadBody = { code: 1018, message: "无法从该链接下载文件（HTTP 404）" }

function stubApi(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      status: 400,
      json: async () => body,
    })),
  )
}

describe("URL 导入失败的提示按界面语言渲染", () => {
  beforeEach(() => {
    setRuntimeLocale("en", enMessages as unknown as AbstractIntlMessages)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("1017 用 errors.notPdf，不是服务端的中文原文", async () => {
    stubApi(pdfBody)

    await expect(request("/papers/upload-from-url", { method: "POST" })).rejects.toThrow(
      enMessages.errors.notPdf,
    )
  })

  it("1018 用 errors.urlDownloadFailed", async () => {
    stubApi(downloadBody)

    await expect(request("/papers/upload-from-url", { method: "POST" })).rejects.toThrow(
      enMessages.errors.urlDownloadFailed,
    )
  })

  it("没映射过的码仍然退回服务端原文", async () => {
    stubApi({ code: 1999, message: "后端新增但我没映射" })

    await expect(request("/papers")).rejects.toThrow("后端新增但我没映射")
  })
})
