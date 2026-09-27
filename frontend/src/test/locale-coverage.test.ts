import { describe, expect, it } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { LOCALES, LOCALE_META, RTL_LOCALES, localeDir } from "@/i18n/locales"

// vitest 的 root 就是前端根目录（配置文件所在处），文案目录相对它定位
const localesDir = join(process.cwd(), "src/i18n/locales")

type Messages = Record<string, unknown>

function readMessages(locale: string): Messages {
  return JSON.parse(readFileSync(join(localesDir, locale, "common.json"), "utf-8")) as Messages
}

function flatten(node: Messages, prefix = ""): Map<string, string> {
  const out = new Map<string, string>()
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [k, v] of flatten(value as Messages, path)) out.set(k, v)
    } else {
      out.set(path, String(value))
    }
  }
  return out
}

const dirs = readdirSync(localesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

const messages = new Map(dirs.map((locale) => [locale, flatten(readMessages(locale))]))

/**
 * W2 的语言面板一时只覆盖了中英，其余 12 语言整段键缺失、界面上会退回中文甚至显示 key。
 * 这条 Test 是那次回退的守门人：任何语言少一个键都算回归。
 */
describe("14 语言文案覆盖", () => {
  it("每个语言的文案目录都在，且与受支持语言列表一一对应", () => {
    expect(dirs).toEqual([...LOCALES].sort())
  })

  it("所有语言的键集与简体中文逐键一致", () => {
    const zh = messages.get("zh")
    expect(zh).toBeDefined()

    for (const locale of dirs) {
      const current = messages.get(locale)
      const missing = [...zh!.keys()].filter((key) => !current?.has(key))
      const extra = [...(current?.keys() ?? [])].filter((key) => !zh!.has(key))
      // 少键 → 界面回退；多键 → 多半是只改了部分语言，两种都该在评审前暴露
      expect({ locale, missing, extra }).toEqual({ locale, missing: [], extra: [] })
    }
  })

  it("没有空文案", () => {
    for (const [locale, map] of messages) {
      const empty = [...map.entries()].filter(([, value]) => value.trim() === "").map(([key]) => key)
      expect({ locale, empty }).toEqual({ locale, empty: [] })
    }
  })

  it("W9 新增的编辑器提示在每种语言里都不是中文原文", () => {
    // 这三个键是 W9 引入的，不存在「某语言恰好写法相同」的合理情况
    const w9Keys = ["papers.editorContentTooLarge", "papers.saveRejected", "errors.contentTooLarge"]
    const zh = messages.get("zh")!

    for (const locale of dirs) {
      if (locale === "zh") continue
      const current = messages.get(locale)!
      const untranslated = w9Keys.filter((key) => current.get(key) === zh.get(key))
      expect({ locale, untranslated }).toEqual({ locale, untranslated: [] })
    }
  })

  it("RTL 语言的版本历史文案是译过的，没有回退成中文", () => {
    // 上面那条「键集一致」只能保证键在，键在而值是中文一样会退回中文界面。
    // 日文/繁体与简体存在「恰好写法相同」的合理情况（取消、保存中…），
    // 阿拉伯语、波斯语、维吾尔语则不可能，所以只对 RTL 三种做逐字比对。
    const zh = messages.get("zh")!
    const historyKeys = [...zh.keys()].filter(
      (key) => key.startsWith("contentHistory.") || key === "papers.openContentHistory",
    )
    expect(historyKeys.length).toBe(41)

    for (const locale of RTL_LOCALES) {
      const current = messages.get(locale)!
      const untranslated = historyKeys.filter((key) => current.get(key) === zh.get(key))
      expect({ locale, untranslated }).toEqual({ locale, untranslated: [] })
    }
  })

  it("RTL 语言的 AI 写作工具栏文案也是译过的", () => {
    // W8（REQ-202609-0264）只写了 zh/en，其余 12 语言整段回退；W9 交付项 ④ 要求
    // 编辑器文案 14 语言全覆盖，这里把这条补齐当成不变量钉住，避免再退回去。
    const zh = messages.get("zh")!
    const aiKeys = [...zh.keys()].filter((key) => key.startsWith("papers.aiWriting"))
    expect(aiKeys.length).toBe(34)

    for (const locale of dirs) {
      if (locale === "zh") continue
      const current = messages.get(locale)!
      const missing = aiKeys.filter((key) => !current.has(key))
      expect({ locale, missing }).toEqual({ locale, missing: [] })
    }

    // 三种 RTL 语言不可能与简体中文写法相同，逐字比对能抓到「键在值没译」
    for (const locale of RTL_LOCALES) {
      const current = messages.get(locale)!
      const untranslated = aiKeys.filter((key) => current.get(key) === zh.get(key))
      expect({ locale, untranslated }).toEqual({ locale, untranslated: [] })
    }
  })
})

describe("RTL 语言", () => {
  it("阿拉伯语、波斯语、维吾尔语走 RTL，其余走 LTR", () => {
    expect([...RTL_LOCALES].sort()).toEqual(["ar", "fa", "ug"])

    for (const locale of LOCALES) {
      const expected = RTL_LOCALES.includes(locale) ? "rtl" : "ltr"
      expect({ locale, dir: LOCALE_META[locale].dir, resolved: localeDir(locale) }).toEqual({
        locale,
        dir: expected,
        resolved: expected,
      })
    }
  })
})
