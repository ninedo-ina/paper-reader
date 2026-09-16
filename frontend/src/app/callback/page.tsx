"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuthStore } from "@/stores/auth-store"
import { useUserStore } from "@/stores/user-store"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Loader2, AlertCircle } from "lucide-react"
import { DEFAULT_LOCALE, matchLocale } from "@/i18n/locales"
import { readLocaleCookie } from "@/i18n/switch-locale"
import { runtimeTranslator } from "@/i18n/runtime"

// /callback 不在 [locale] 段里，没有 next-intl 的上下文，只能自己判断语言：
// 先看用户选过的 Cookie，再看浏览器语言，最后回落到默认语言。
// 文案本身走运行时翻译器 —— 根布局的 RuntimeLocaleBridge 已经按同一个 Cookie 注册好了消息。
function getLocale(): string {
  return readLocaleCookie() ?? matchLocale(typeof navigator === "undefined" ? null : navigator.language) ?? DEFAULT_LOCALE
}

export default function GitHubCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { githubLogin } = useAuthStore()
  const loadProfile = useUserStore((s) => s.loadProfile)
  const [error, setError] = useState<string | null>(null)
  const [twoFactor, setTwoFactor] = useState(false)
  const t = runtimeTranslator("auth")

  useEffect(() => {
    const code = searchParams.get("code")
    if (!code) {
      setError(t("callbackMissingCode"))
      return
    }
    const locale = getLocale()
    githubLogin(code)
      .then(async () => {
        // 账号开了两步验证时，GitHub 授权只是第一步：挑战凭证已存进
        // sessionStorage，转到登录页继续输入动态码或恢复码。
        if (useAuthStore.getState().twoFactorChallengeToken) {
          setTwoFactor(true)
          window.location.href = `/${locale}/login?twofactor=1`
          return
        }
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
          <CardTitle>{t("githubLogin")}</CardTitle>
          <CardDescription>
            {error
              ? t("callbackFailed")
              : twoFactor
                ? t("callbackTwoFactor")
                : t("callbackCompleting")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {error ? (
            <>
              <AlertCircle className="size-10 text-red-500" />
              <p className="text-sm text-red-500">{error}</p>
              <Button variant="secondary" onClick={() => router.push(`/${getLocale()}/login`)}>
                {t("backToLogin")}
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
