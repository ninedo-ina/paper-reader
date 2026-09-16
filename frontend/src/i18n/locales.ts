/**
 * 语言注册表 / Locale registry
 *
 * 这里是全站语言的唯一事实来源：路由允许的 locale 列表、语言的本地名称、
 * 书写方向（LTR/RTL）都从这里取。新增语言时只改这一处 + 补一份
 * `locales/<code>/common.json`，切换器、设置页和后端校验会自动跟上。
 */

/**
 * 支持的语言，顺序即切换器里的展示顺序（简体中文在最前，作为默认语言）。
 *
 * 注意：`en` 不在本次需求列出的 13 种语言里，但它是本站原有的语言之一，
 * 线上已有用户把偏好设成了 `en`。直接下掉会让这些用户和 /en/* 老链接一起失效，
 * 所以保留在列表末尾，仅作为兼容项。
 */
export const LOCALES = [
  'zh',
  'zh-Hant',
  'en',
  'bo',
  'ug',
  'de',
  'ar',
  'ko',
  'ja',
  'fr',
  'vi',
  'es',
  'it',
  'fa',
] as const

export type AppLocale = (typeof LOCALES)[number]

/** 从右往左书写的语言 / Right-to-left locales */
export const RTL_LOCALES: readonly AppLocale[] = ['ar', 'fa', 'ug']

export interface LocaleMeta {
  /** 语言自身的写法，切换器里优先展示它 */
  nativeName: string
  /** 英文名，兜底与无障碍标签用 */
  englishName: string
  /** 书写方向 */
  dir: 'ltr' | 'rtl'
}

export const LOCALE_META: Record<AppLocale, LocaleMeta> = {
  zh: { nativeName: '简体中文', englishName: 'Simplified Chinese', dir: 'ltr' },
  'zh-Hant': { nativeName: '繁體中文', englishName: 'Traditional Chinese', dir: 'ltr' },
  en: { nativeName: 'English', englishName: 'English', dir: 'ltr' },
  bo: { nativeName: 'བོད་ཡིག', englishName: 'Tibetan', dir: 'ltr' },
  ug: { nativeName: 'ئۇيغۇرچە', englishName: 'Uyghur', dir: 'rtl' },
  de: { nativeName: 'Deutsch', englishName: 'German', dir: 'ltr' },
  ar: { nativeName: 'العربية', englishName: 'Arabic', dir: 'rtl' },
  ko: { nativeName: '한국어', englishName: 'Korean', dir: 'ltr' },
  ja: { nativeName: '日本語', englishName: 'Japanese', dir: 'ltr' },
  fr: { nativeName: 'Français', englishName: 'French', dir: 'ltr' },
  vi: { nativeName: 'Tiếng Việt', englishName: 'Vietnamese', dir: 'ltr' },
  es: { nativeName: 'Español', englishName: 'Spanish', dir: 'ltr' },
  it: { nativeName: 'Italiano', englishName: 'Italian', dir: 'ltr' },
  fa: { nativeName: 'فارسی', englishName: 'Persian', dir: 'rtl' },
}

/** 默认语言 / Default locale */
export const DEFAULT_LOCALE: AppLocale = 'zh'

/** 保存语言选择的 Cookie 名，和 next-intl 中间件用的是同一个 */
export const LOCALE_COOKIE = 'NEXT_LOCALE'

/** 判断是否受支持的语言 / Narrow a string to AppLocale */
export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

/** 取书写方向 / Text direction of a locale */
export function localeDir(locale: string): 'ltr' | 'rtl' {
  return isAppLocale(locale) && LOCALE_META[locale].dir === 'rtl' ? 'rtl' : 'ltr'
}

/** 语言在切换器里的显示名 / Display name for a locale code */
export function localeLabel(locale: string): string {
  return isAppLocale(locale) ? LOCALE_META[locale].nativeName : locale
}

/** 繁体中文的常见地区标签，navigator.language 可能给其中任意一个 */
const HANT_REGIONS = ['hant', 'tw', 'hk', 'mo']

/**
 * 把浏览器语言标签（zh-TW / en-US / ug-Arab-CN …）匹配到受支持的语言。
 * 匹配不到时返回 null，交给调用方决定兜底语言。
 */
export function matchLocale(tag: string | null | undefined): AppLocale | null {
  if (!tag) return null
  const normalized = tag.replace(/_/g, '-').toLowerCase()
  const exact = LOCALES.find((l) => l.toLowerCase() === normalized)
  if (exact) return exact
  const [base, ...rest] = normalized.split('-')
  // zh-Hant / zh-TW / zh-HK / zh-MO 都归到繁体中文
  if (base === 'zh' && rest.some((part) => HANT_REGIONS.includes(part))) return 'zh-Hant'
  const byBase = LOCALES.find((l) => l.toLowerCase() === base)
  return byBase ?? null
}
