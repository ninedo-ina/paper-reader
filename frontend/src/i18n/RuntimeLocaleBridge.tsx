"use client"

/**
 * 把当前语言与消息表同步给 src/i18n/runtime.ts，
 * 供组件外代码（API 客户端、AI Provider、store 等）取用。
 *
 * 写在渲染期而不是 useEffect：根布局是整页加载时最先渲染的组件之一，
 * 渲染期登记能保证首屏之后立刻发起的异步请求已经能拿到消息表。
 * 赋值是幂等的，重复渲染没有副作用。
 */

import { useLocale, useMessages } from "next-intl"
import { setRuntimeLocale } from "./runtime"
import { isAppLocale, DEFAULT_LOCALE } from "./locales"

export function RuntimeLocaleBridge() {
  const locale = useLocale()
  const messages = useMessages()
  setRuntimeLocale(isAppLocale(locale) ? locale : DEFAULT_LOCALE, messages)
  return null
}
