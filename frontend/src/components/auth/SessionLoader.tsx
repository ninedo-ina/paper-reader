"use client"

import { useState, useEffect } from "react"
import { useAuthStore, loadPersistedSession } from "@/stores/auth-store"
import { useUserStore } from "@/stores/user-store"

export function SessionLoader({ children }: { children: React.ReactNode }) {
  const restoreSession = useAuthStore((s) => s.restoreSession)
  const loadProfile = useUserStore((s) => s.loadProfile)

  // 在 render 阶段同步恢复 session，确保子组件 mount 时 token 已就绪
  // 避免子组件 useEffect（bottom-up 先触发）在 token 恢复之前发出无认证的 API 请求
  useState(() => {
    const tokens = loadPersistedSession()
    if (tokens) {
      restoreSession(tokens)
    }
  })

  useEffect(() => {
    const tokens = loadPersistedSession()
    if (tokens) {
      loadProfile().catch(() => { /* token may be expired */ })
    }
  }, [loadProfile])

  return <>{children}</>
}
