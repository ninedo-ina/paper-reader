"use client"

import { useEffect, useLayoutEffect } from "react"
import { useAuthStore, loadPersistedSession } from "@/stores/auth-store"
import { useUserStore } from "@/stores/user-store"

export function SessionLoader({ children }: { children: React.ReactNode }) {
  const restoreSession = useAuthStore((s) => s.restoreSession)
  const loadProfile = useUserStore((s) => s.loadProfile)

  // useLayoutEffect 是 top-down 触发（父 → 子），先于子组件的 useEffect（bottom-up）
  // 确保 token 在 PaperList/Sidebar 发起 API 请求前已恢复到 API client
  useLayoutEffect(() => {
    const tokens = loadPersistedSession()
    if (tokens) {
      restoreSession(tokens)
    }
  }, [restoreSession])

  useEffect(() => {
    const tokens = loadPersistedSession()
    if (tokens) {
      loadProfile().catch(() => { /* token may be expired */ })
    }
  }, [loadProfile])

  return <>{children}</>
}
