import type { Metadata } from "next"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages, getTranslations } from "next-intl/server"
import { ThemeProvider } from "@/components/layout/ThemeProvider"
import { SessionLoader } from "@/components/auth/SessionLoader"
import { localeDir } from "@/i18n/locales"
import { RuntimeLocaleBridge } from "@/i18n/RuntimeLocaleBridge"
import "./globals.css"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app")
  return {
    title: `${t("name")} - ${t("tagline")}`,
    applicationName: "PaperHelper",
    description: t("description"),
    icons: {
      icon: "/paperhelper-favicon-light.svg?v=0.1.51",
    },
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()
  const messages = await getMessages()

  // 根布局位于 [locale] 之上，客户端软导航不会重渲染它，<html lang/dir> 只在整页加载时更新。
  // 因此语言切换统一走整页跳转，见 src/i18n/switch-locale.ts。
  return (
    <html lang={locale} dir={localeDir(locale)} suppressHydrationWarning>
      <body className="theme-transition">
        <NextIntlClientProvider messages={messages}>
          <RuntimeLocaleBridge />
          <ThemeProvider>
            <SessionLoader>{children}</SessionLoader>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
