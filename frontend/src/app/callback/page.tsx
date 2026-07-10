"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuthStore } from "@/stores/auth-store"
import { useUserStore } from "@/stores/user-store"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Loader2, AlertCircle } from "lucide-react"

function getLocale(): string {
  if (typeof document === "undefined") return "zh"
  const cookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith("NEXT_LOCALE="))
  if (cookie) return cookie.split("=")[1]
  const nav = navigator.language
  return nav.startsWith("zh") ? "zh" : "en"
}

export default function GitHubCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { githubLogin } = useAuthStore()
  const loadProfile = useUserStore((s) => s.loadProfile)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const code = searchParams.get("code")
    if (!code) {
      setError("Missing authorization code")
      return
    }
    const locale = getLocale()
    githubLogin(code)
      .then(async () => {
        await loadProfile()
        window.location.href = `/${locale}`
      })
      .catch((e) => {
        setError((e as Error).message)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface-1)]">
      <Card variant="glass" className="w-full max-w-md mx-auto text-center">
        <CardHeader>
          <CardTitle>GitHub Login</CardTitle>
          <CardDescription>
            {error ? "Authentication failed" : "Completing login..."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {error ? (
            <>
              <AlertCircle className="size-10 text-red-500" />
              <p className="text-sm text-red-500">{error}</p>
              <Button variant="secondary" onClick={() => router.push(`/${getLocale()}/login`)}>
                Back to login
              </Button>
            </>
          ) : (
            <Loader2 className="size-10 animate-spin text-[var(--text-secondary)]" />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
