"use client"

import { useEffect } from "react"
import { useAuthStore, loadPersistedSession } from "@/stores/auth-store"
import { useUserStore } from "@/stores/user-store"

export function SessionLoader({ children }: { children: React.ReactNode }) {
  const restoreSession = useAuthStore((s) => s.restoreSession)
  const loadProfile = useUserStore((s) => s.loadProfile)

  useEffect(() => {
    const tokens = loadPersistedSession()
    if (tokens) {
      restoreSession(tokens)
      loadProfile().catch(() => { /* token may be expired */ })
    }
  }, [restoreSession, loadProfile])

  return <>{children}</>
}
