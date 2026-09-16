/**
 * 语言切换的副作用 / Locale switching side effects
 *
 * 一次语言切换要做三件事：
 * 1. 把语言写进 Cookie —— next-intl 中间件按它记住语言，之后访问 `/` 也会落到这个语言；
 * 2. 已登录时写回用户偏好设置（个人设置 → 偏好设置 → 语言）；
 * 3. 跳到同一页面的新语言地址。
 *
 * 第 3 步刻意用整页跳转（window.location.assign）而不是 router.push：
 * 根布局 app/layout.tsx 在 [locale] 之上，客户端软导航不会重新渲染它，
 * `<html lang>`、`<html dir>` 和 NextIntlClientProvider 的文案都停在旧语言上
 * —— 这正是「登录页语言切换点了没反应」的原因。整页跳转能让整棵树按新语言重渲染。
 */

import { LOCALE_COOKIE, isAppLocale, type AppLocale } from './locales'

/**
 * 用户是否在这台设备上「亲自」选过语言。
 *
 * 不能只看 Cookie：next-intl 中间件在每次请求里都会按协商结果把 NEXT_LOCALE 写上，
 * 所以 Cookie 存在 ≠ 用户选过。这里额外记一个 localStorage 标记，
 * 用来区分「用户选的语言」和「系统协商出来的默认语言」——只有前者才该覆盖账号偏好。
 */
export const LOCALE_CHOSEN_KEY = 'paperhelper.locale-chosen'

/** 把语言写进 Cookie，供 next-intl 中间件读取 */
export function writeLocaleCookie(locale: AppLocale, maxAge = 60 * 60 * 24 * 365): void {
  if (typeof document === 'undefined') return
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${maxAge}; SameSite=Lax`
}

/** 记录「用户主动选过语言」 */
export function markLocaleChosen(locale: AppLocale): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LOCALE_CHOSEN_KEY, locale)
  } catch {
    // 隐私模式下 localStorage 可能不可写，选语言本身仍然生效
  }
}

/** 用户是否主动选过语言 */
export function hasExplicitLocaleChoice(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return isAppLocale(window.localStorage.getItem(LOCALE_CHOSEN_KEY))
  } catch {
    return false
  }
}

/** 读取当前 Cookie 里的语言；没有或不受支持时返回 null */
export function readLocaleCookie(): AppLocale | null {
  if (typeof document === 'undefined') return null
  const hit = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LOCALE_COOKIE}=`))
  if (!hit) return null
  const value = decodeURIComponent(hit.slice(LOCALE_COOKIE.length + 1))
  return isAppLocale(value) ? value : null
}

/**
 * 把路径里的语言前缀换成目标语言。
 * `/zh/login` → `/en/login`；没有语言前缀的路径（如 `/callback`）原样返回。
 */
export function withLocalePrefix(pathname: string, locale: AppLocale): string {
  if (!pathname.startsWith('/')) return pathname
  const segments = pathname.split('/')
  // segments[0] 恒为空串（路径以 / 开头），语言前缀在 segments[1]
  if (segments.length > 1 && isAppLocale(segments[1])) {
    segments[1] = locale
    return segments.join('/')
  }
  return `/${locale}${pathname === '/' ? '' : pathname}`
}

/** 切换语言：写 Cookie + 整页跳到新语言地址 */
export function applyLocale(
  locale: AppLocale,
  pathname: string,
  navigate: (url: string) => void = (url) => window.location.assign(url),
): void {
  writeLocaleCookie(locale)
  markLocaleChosen(locale)
  navigate(withLocalePrefix(pathname, locale))
}
