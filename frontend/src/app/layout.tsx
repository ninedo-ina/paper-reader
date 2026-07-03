import type { Metadata } from "next"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages } from "next-intl/server"
import { ThemeProvider } from "@/components/layout/ThemeProvider"
import { SessionLoader } from "@/components/auth/SessionLoader"
import "./globals.css"

export const metadata: Metadata = {
  title: "Paper Reader - 论文在线阅读平台",
  description: "基于 GROBID 的学术论文在线阅读、批注、笔记与 AI 辅助阅读平台",
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="theme-transition">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <SessionLoader>{children}</SessionLoader>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
