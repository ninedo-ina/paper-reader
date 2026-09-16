/**
 * 把当前语言写回用户偏好设置 / Persist the chosen locale to user settings
 *
 * 需求：在登录页选的语言，进入系统后要跟着走，同时用户个人设置里的「偏好设置 → 语言」
 * 也要更新成这个语言。这里负责后半截：已登录时把语言 PUT 到 /api/settings。
 *
 * 写失败不阻断切换（Cookie 才是当次生效的关键），只做静默忽略 + 控制台告警。
 */

import { getSettings, updateSettings } from '@/lib/api/settings'
import { isAppLocale, type AppLocale } from './locales'
import { applyLocale, hasExplicitLocaleChoice } from './switch-locale'

export async function saveLocalePreference(locale: AppLocale): Promise<boolean> {
  if (!isAppLocale(locale)) return false
  try {
    await updateSettings({ language: locale })
    return true
  } catch (error) {
    console.warn('[i18n] failed to persist language preference', error)
    return false
  }
}

/** 读账号偏好里的语言；没登录、请求失败或值不受支持时返回 null */
export async function loadLocalePreference(): Promise<AppLocale | null> {
  try {
    const settings = await getSettings()
    return isAppLocale(settings.language) ? settings.language : null
  } catch (error) {
    console.warn('[i18n] failed to read language preference', error)
    return null
  }
}

/**
 * 登录完成后的语言归属 / Settle the locale right after a successful login.
 *
 * - 用户在登录页（或之前）主动选过语言 → 把选择写进账号偏好，界面就用他选的；
 * - 没选过（这台设备是新的，语言是中间件协商出来的默认值）→ 跟随账号偏好，
 *   并把界面整页切过去，这样换设备登录看到的还是自己设定的语言。
 *
 * 返回是否发生了跳转。
 */
export async function settleLocaleAfterLogin(
  currentLocale: string,
  pathname: string,
): Promise<boolean> {
  if (hasExplicitLocaleChoice()) {
    if (isAppLocale(currentLocale)) void saveLocalePreference(currentLocale)
    return false
  }
  return adoptAccountLocale(currentLocale, pathname)
}

/**
 * 本机没有「用户选过语言」的记录时，跟随账号偏好设置里的语言。
 * 返回是否发生了跳转。
 */
export async function adoptAccountLocale(
  currentLocale: string,
  pathname: string,
): Promise<boolean> {
  if (hasExplicitLocaleChoice()) return false
  const preferred = await loadLocalePreference()
  if (preferred && preferred !== currentLocale) {
    applyLocale(preferred, pathname)
    return true
  }
  return false
}
