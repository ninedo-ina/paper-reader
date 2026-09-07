"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useAuthStore } from "@/stores/auth-store"
import * as authApi from "@/lib/api/auth"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/Card"
import { GitHubLoginButton } from "@/components/auth/GitHubLoginButton"
import NextLink from "next/link"

type LoginMode = "password" | "code"

export function LoginForm() {
  const t = useTranslations("auth")
  const router = useRouter()
  const { login, emailCodeLogin, isLoading, error, clearError } = useAuthStore()
  const [mode, setMode] = useState<LoginMode>("password")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [countdown, setCountdown] = useState(0)
  const [sendingCode, setSendingCode] = useState(false)

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000)
    return () => clearInterval(timer)
  }, [countdown])

  const handleSendCode = async () => {
    if (!email || countdown > 0) return
    setSendingCode(true)
    try {
      await authApi.sendEmailCode({ email })
      setCountdown(60)
    } catch {
      // error is logged by API layer
    } finally {
      setSendingCode(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    try {
      if (mode === "password") {
        await login({ email, password })
      } else {
        await emailCodeLogin({ email, code })
      }
      router.push("/")
    } catch {
      // error is set in store
    }
  }

  const switchMode = () => {
    clearError()
    setMode(mode === "password" ? "code" : "password")
    setPassword("")
    setCode("")
  }

  return (
    <Card variant="default" className="flex h-full w-full max-w-md flex-col shadow-[0_24px_70px_rgba(34,71,96,0.12)] backdrop-blur-xl">
      <CardHeader className="px-8 pt-8 pb-5">
        <CardTitle className="text-2xl tracking-tight">{t("loginUnifiedTitle")}</CardTitle>
        <CardDescription className="mt-2">{t("loginUnifiedSubtitle")}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
        <CardContent className="flex-1 space-y-5 px-8 py-2">
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          {mode === "password" ? (
            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t("passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="code">{t("code")}</Label>
              <div className="flex gap-2">
                <Input
                  id="code"
                  type="text"
                  placeholder={t("codePlaceholder")}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleSendCode}
                  disabled={!email || countdown > 0 || sendingCode}
                  className="shrink-0"
                >
                  {sendingCode
                    ? t("sendingCode")
                    : countdown > 0
                      ? t("codeSentCountdown", { seconds: countdown })
                      : t("sendCode")}
                </Button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={switchMode}
            className="text-sm font-medium text-[var(--accent)] hover:underline"
          >
            {mode === "password" ? t("switchToCode") : t("switchToPassword")}
          </button>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
        </CardContent>
        <CardFooter className="flex-col gap-3 px-8 pb-8 pt-5">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? t("loggingIn") : mode === "password" ? t("login") : t("verifyCode")}
          </Button>
          <div className="relative w-full">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[var(--border-subtle)]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[var(--surface-0)] px-2 text-[var(--text-tertiary)]">or</span>
            </div>
          </div>
          <GitHubLoginButton />
          <p className="mt-2 text-center text-xs leading-5 text-[var(--text-tertiary)]">
            {t("agreementPrefix")}
            <NextLink href="/terms" className="text-[var(--accent)] hover:underline">
              {t("termsLink")}
            </NextLink>
            {t("and")}
            <NextLink href="/privacy" className="text-[var(--accent)] hover:underline">
              {t("privacyLink")}
            </NextLink>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
