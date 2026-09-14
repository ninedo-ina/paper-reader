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
  const {
    login,
    emailCodeLogin,
    verifyTwoFactor,
    cancelTwoFactor,
    twoFactorChallengeToken,
    hydrateChallenge,
    isLoading,
    error,
    clearError,
  } = useAuthStore()
  const [mode, setMode] = useState<LoginMode>("password")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [countdown, setCountdown] = useState(0)
  const [sendingCode, setSendingCode] = useState(false)
  const [twoFactorCode, setTwoFactorCode] = useState("")
  const [trustDevice, setTrustDevice] = useState(true)

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000)
    return () => clearInterval(timer)
  }, [countdown])

  // GitHub 回调等整页跳转场景，挑战凭证留在 sessionStorage 里
  useEffect(() => {
    hydrateChallenge()
  }, [hydrateChallenge])

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
      // 需要二次验证时先不跳转，页面上会切成挑战步骤
      if (useAuthStore.getState().twoFactorChallengeToken) return
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

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    try {
      await verifyTwoFactor(twoFactorCode.trim(), trustDevice)
      router.push("/")
    } catch {
      setTwoFactorCode("")
    }
  }

  const backToLogin = () => {
    cancelTwoFactor()
    setTwoFactorCode("")
  }

  // 账号开了两步验证时，密码/验证码/GitHub 三种方式都会先落到这里
  if (twoFactorChallengeToken) {
    return (
      <Card
        variant="default"
        className="w-full max-w-md shadow-[0_24px_70px_rgba(34,71,96,0.12)] backdrop-blur-xl"
      >
        <form onSubmit={handleTwoFactorSubmit}>
          <CardHeader className="px-8 pt-8 pb-5">
            <CardTitle className="text-2xl tracking-tight">{t("twoFactorTitle")}</CardTitle>
            <CardDescription className="mt-2">{t("twoFactorSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 px-8 py-2">
            <div className="space-y-2">
              <Label htmlFor="two-factor-code">{t("twoFactorCode")}</Label>
              <Input
                id="two-factor-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder={t("twoFactorCodePlaceholder")}
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\s/g, ""))}
                maxLength={6}
                required
                autoFocus
              />
              <p className="text-xs leading-5 text-[var(--text-tertiary)]">{t("twoFactorHint")}</p>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={trustDevice}
                onChange={(e) => setTrustDevice(e.target.checked)}
                className="size-4 accent-[var(--accent)]"
              />
              {t("trustDevice")}
            </label>

            {error && <p className="text-sm text-red-500">{error}</p>}
          </CardContent>
          <CardFooter className="flex-col gap-3 px-8 pb-8 pt-5">
            <Button type="submit" className="w-full" disabled={isLoading || !twoFactorCode}>
              {isLoading ? t("loggingIn") : t("verifyAndLogin")}
            </Button>
            <button
              type="button"
              onClick={backToLogin}
              className="text-sm font-medium text-[var(--accent)] hover:underline"
            >
              {t("backToLogin")}
            </button>
          </CardFooter>
        </form>
      </Card>
    )
  }

  return (
    <Card variant="default" className="w-full max-w-md shadow-[0_24px_70px_rgba(34,71,96,0.12)] backdrop-blur-xl">
      <CardHeader className="px-8 pt-8 pb-5">
        <CardTitle className="text-2xl tracking-tight">{t("loginUnifiedTitle")}</CardTitle>
        <CardDescription className="mt-2">{t("loginUnifiedSubtitle")}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-5 px-8 py-2">
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
