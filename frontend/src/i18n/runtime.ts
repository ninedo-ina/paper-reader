"use client"

/**
 * React 组件之外的翻译入口。
 *
 * `useTranslations` 只能在组件里用，但项目里有一批文案产生在组件之外：
 * API 客户端的错误码映射、AI Provider 的报错、store 里的异步失败提示、
 * 设备名兜底等。这些代码拿不到 hook，于是这里做一个「运行时消息注册表」：
 * 根布局里的 <RuntimeLocaleBridge /> 把当前语言和消息表写进来，
 * 其它模块通过 runtimeTranslator(namespace) 取一个和 useTranslations 行为一致的
 * 翻译函数。
 *
 * 注意：消息表由根布局在**渲染期**写入。模块顶层求值阶段（例如 zustand
 * persist 的 rehydrate）还没有消息表，此时取到的翻译函数会把 key 原样返回。
 * 因此这类「模块加载即产生」的文案不要在 store 里落成字符串，交给渲染层翻。
 */

import { createTranslator, type AbstractIntlMessages } from "next-intl"
import { DEFAULT_LOCALE, type AppLocale } from "./locales"

export type RuntimeTranslator = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string

let currentLocale: AppLocale = DEFAULT_LOCALE
let currentMessages: AbstractIntlMessages | undefined

/** 由 <RuntimeLocaleBridge /> 调用，登记当前语言与消息表 */
export function setRuntimeLocale(locale: AppLocale, messages: AbstractIntlMessages | undefined) {
  currentLocale = locale
  currentMessages = messages
}

/** 取当前语言（组件外使用） */
export function runtimeLocale(): AppLocale {
  return currentLocale
}

/**
 * 取一个绑定到当前语言、指定命名空间的翻译函数。
 * 消息表尚未就绪时退化为「返回 key」，不会抛错，也不会把界面打崩。
 */
export function runtimeTranslator(namespace: string): RuntimeTranslator {
  const messages = currentMessages
  if (!messages) return (key) => key
  const translate = createTranslator({
    locale: currentLocale,
    messages,
    namespace,
    onError: () => {},
  }) as unknown as RuntimeTranslator
  return (key, values) => {
    try {
      return translate(key, values)
    } catch {
      return key
    }
  }
}
