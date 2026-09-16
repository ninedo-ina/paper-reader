"use client"

import { useEffect, useRef } from "react"
import { useLocale } from "next-intl"
import { usePathname } from "next/navigation"
import { useAuthStore, loadPersistedSession } from "@/stores/auth-store"
import { useUserStore } from "@/stores/user-store"
import { adoptAccountLocale } from "@/i18n/locale-preference"

export function SessionLoader({ children }: { children: React.ReactNode }) {
  const restoreSession = useAuthStore((s) => s.restoreSession)
  const loadProfile = useUserStore((s) => s.loadProfile)
  const locale = useLocale()
  const pathname = usePathname()
  const settled = useRef(false)

  useEffect(() => {
    const tokens = loadPersistedSession()
    if (!tokens) return
    restoreSession(tokens)
    loadProfile().catch(() => { /* token may be expired */ })
    // 换设备登录（本机没有用户选语言的记录）时，界面要跟随账号偏好设置里的语言，
    // 而不是停在中件间协商出来的默认语言。每次整页加载只认一次，避免软导航反复请求。
    if (settled.current) return
    settled.current = true
    void adoptAccountLocale(locale, pathname)
  }, [restoreSession, loadProfile, locale, pathname])

  return <>{children}</>
}
