"use client"

import { useEffect } from "react"
import { useAuthStore, loadPersistedSession } from "@/stores/auth-store"

export function SessionLoader({ children }: { children: React.ReactNode }) {
  const restoreSession = useAuthStore((s) => s.restoreSession)

  useEffect(() => {
    const tokens = loadPersistedSession()
    if (tokens) {
      restoreSession(tokens)
    }
  }, [restoreSession])

  return <>{children}</>
}
