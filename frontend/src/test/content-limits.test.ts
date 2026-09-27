import { afterEach, describe, expect, it, vi } from "vitest"
import { checkContentSize } from "@/lib/content-limits"
import { utf8ByteLength } from "@/lib/utils"
import { CONTENT_TOO_LARGE_CODE } from "@/hooks/useAutosave"
import { getContentLimits } from "@/lib/api/papers"
import type { ContentLimitsDto } from "@/lib/api/types"

const limits: ContentLimitsDto = {
  maxJsonBytes: 100,
  maxHtmlBytes: 200,
  maxReadableBytes: 400,
  maxSnapshotCount: 20,
  maxSnapshotAgeDays: 90,
}

/** 中文一个字在 UTF-8 里占 3 字节，按 length 判上限会放过三分之二的超限正文 */
describe("utf8ByteLength", () => {
  it("按 UTF-8 编码计字节，而不是字符串长度", () => {
    expect(utf8ByteLength("abc")).toBe(3)
    expect(utf8ByteLength("正文")).toBe(6)
    expect(utf8ByteLength("A中")).toBe(4)
    expect(utf8ByteLength("")).toBe(0)
  })

  it("代理对（emoji 等）按 4 字节计，不重复计数", () => {
    expect("😀".length).toBe(2)
    expect(utf8ByteLength("😀")).toBe(4)
    expect(utf8ByteLength("😀😀")).toBe(8)
  })
})

describe("提交前自检正文体积", () => {
  const doc = (text: string) => ({
    contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] },
    contentHtml: `<p>${text}</p>`,
  })

  it("拿不到限额就不拦，交给服务端判", () => {
    expect(checkContentSize(doc("随便写多少"), null)).toBeNull()
  })

  it("超限时给出实际体积和上限，好让提示说清楚差多少", () => {
    const content = doc("中".repeat(100)) // JSON 里每个中文字 3 字节，必然过 100
    const rejection = checkContentSize(content, limits)

    expect(rejection).not.toBeNull()
    expect(rejection?.code).toBe(CONTENT_TOO_LARGE_CODE)
    expect(rejection?.limit).toBe(limits.maxJsonBytes)
    expect(rejection?.size).toBe(utf8ByteLength(JSON.stringify(content.contentJson)))
    expect(rejection?.size).toBeGreaterThan(limits.maxJsonBytes)
  })

  it("节点树没超但渲染结果超了，也要拦下来", () => {
    // JSON 短（上限宽松），HTML 长（上限严格）
    const content = { contentJson: { type: "doc" }, contentHtml: `<p>${"x".repeat(300)}</p>` }
    const rejection = checkContentSize(content, limits)

    expect(rejection?.code).toBe(CONTENT_TOO_LARGE_CODE)
    expect(rejection?.limit).toBe(limits.maxHtmlBytes)
    expect(rejection?.size).toBe(utf8ByteLength(content.contentHtml))
  })

  it("两头都没超就不拦", () => {
    expect(checkContentSize(doc("短"), limits)).toBeNull()
  })

  it("contentJson 为 null 的草稿不该把自检炸掉", () => {
    expect(checkContentSize({ contentJson: null, contentHtml: "<p></p>" }, limits)).toBeNull()
  })
})

/** 服务端也会独立判一次体积；前端拿不到限额时，超限只能由 1014 暴露出来 */
describe("1014 在 API 层的落点", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("把正文超限的业务码翻成当前界面语言的提示，而不是漏出服务端原文", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ code: 1014, message: "正文体积 3.0 MB 超过单篇上限 2.0 MB", data: null }), {
          status: 413,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    )

    // 测试环境的界面语言是简体中文（src/test/setup.ts 注册的运行时文案）
    await expect(getContentLimits()).rejects.toMatchObject({
      code: 1014,
      message: "正文体积超过单篇上限，请精简或拆分后再保存",
    })
  })
})
