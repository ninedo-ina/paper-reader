import type { ReactElement, ReactNode } from "react"
import { NextIntlClientProvider } from "next-intl"
import type { AbstractIntlMessages } from "next-intl"
import zhMessages from "@/i18n/locales/zh/common.json"

/**
 * 组件测试统一用简体中文的文案跑：断言里写的就是界面上真实出现的那句话，
 * 不用为了 i18n 把断言改成 key。缺了这层 Provider，组件里的 useTranslations 会直接抛错。
 */
export function IntlProvider({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="zh" messages={zhMessages as unknown as AbstractIntlMessages}>
      {children}
    </NextIntlClientProvider>
  )
}

export function withIntl(node: ReactElement) {
  return <IntlProvider>{node}</IntlProvider>
}
