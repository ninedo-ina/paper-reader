import { describe, it, expect, vi, beforeEach } from "vitest"
import { LOCALES, LOCALE_META, DEFAULT_LOCALE, isAppLocale, localeDir, matchLocale } from "@/i18n/locales"
import {
  applyLocale,
  withLocalePrefix,
  writeLocaleCookie,
  markLocaleChosen,
  hasExplicitLocaleChoice,
  readLocaleCookie,
  LOCALE_CHOSEN_KEY,
} from "@/i18n/switch-locale"

/**
 * 语言切换的副作用是需求的核心：登录页选的语言既要当次生效（Cookie + 整页跳转），
 * 又要记成「用户主动选过」，好让登录后把它写进账号偏好设置。
 */
describe("switch-locale", () => {
  beforeEach(() => {
    document.cookie = "NEXT_LOCALE=; path=/; max-age=0"
    window.localStorage.clear()
  })

  it("把路径里的语言前缀换成目标语言", () => {
    expect(withLocalePrefix("/zh/papers/1", "ar")).toBe("/ar/papers/1")
    expect(withLocalePrefix("/zh", "ja")).toBe("/ja")
    expect(withLocalePrefix("/", "de")).toBe("/de")
  })

  it("没有语言前缀的路径（/callback）补上目标语言", () => {
    expect(withLocalePrefix("/callback", "ar")).toBe("/ar/callback")
  })

  it("切语言时写 Cookie、记标记，并整页跳到新语言地址", () => {
    const navigate = vi.fn()
    applyLocale("ar", "/zh/papers/1", navigate)

    expect(document.cookie).toContain("NEXT_LOCALE=ar")
    expect(window.localStorage.getItem(LOCALE_CHOSEN_KEY)).toBe("ar")
    expect(hasExplicitLocaleChoice()).toBe(true)
    expect(navigate).toHaveBeenCalledWith("/ar/papers/1")
  })

  it("读回 Cookie 时只认受支持的语言", () => {
    writeLocaleCookie("fa")
    expect(readLocaleCookie()).toBe("fa")

    document.cookie = "NEXT_LOCALE=kl; path=/"
    expect(readLocaleCookie()).toBeNull()
  })

  it("只有用户主动选过语言才算「有明确选择」", () => {
    // 中间件按浏览器语言写 Cookie 的情况：Cookie 有值，但不是用户选的
    writeLocaleCookie("ja")
    expect(hasExplicitLocaleChoice()).toBe(false)

    markLocaleChosen("ja")
    expect(hasExplicitLocaleChoice()).toBe(true)
  })
})

describe("locales", () => {
  it("覆盖需求要求的全部语言，简体中文为默认", () => {
    expect(DEFAULT_LOCALE).toBe("zh")
    for (const code of ["zh", "zh-Hant", "bo", "ug", "de", "ar", "ko", "ja", "fr", "vi", "es", "it", "fa"]) {
      expect(isAppLocale(code)).toBe(true)
    }
  })

  it("阿拉伯语、波斯语、维吾尔语是 RTL，其余是 LTR", () => {
    expect(localeDir("ar")).toBe("rtl")
    expect(localeDir("fa")).toBe("rtl")
    expect(localeDir("ug")).toBe("rtl")
    expect(localeDir("zh")).toBe("ltr")
    expect(localeDir("ja")).toBe("ltr")
    // 不受支持的语言一律按 LTR 处理
    expect(localeDir("kl")).toBe("ltr")
  })

  it("每个语言都有显示名", () => {
    for (const code of LOCALES) {
      expect(LOCALE_META[code].nativeName.length).toBeGreaterThan(0)
      expect(LOCALE_META[code].englishName.length).toBeGreaterThan(0)
    }
  })

  it("把浏览器语言标签匹配到受支持的语言", () => {
    expect(matchLocale("zh-CN")).toBe("zh")
    expect(matchLocale("zh-TW")).toBe("zh-Hant")
    expect(matchLocale("zh_HK")).toBe("zh-Hant")
    expect(matchLocale("ug-Arab-CN")).toBe("ug")
    expect(matchLocale("en-US")).toBe("en")
    expect(matchLocale("pt-BR")).toBeNull()
    expect(matchLocale(null)).toBeNull()
  })
})
