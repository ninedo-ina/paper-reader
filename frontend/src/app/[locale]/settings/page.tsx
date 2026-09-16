"use client"

import { useState, useEffect, useCallback } from "react"
import { useLocale, useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { ArrowLeft, Sun, Moon, Languages, Bot, Save, Loader2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { LanguagePicker } from "@/components/settings/LanguagePicker"
import { getSettings, updateSettings } from "@/lib/api/settings"
import { MODELS } from "@/stores/chat-store"
import { cn } from "@/lib/utils"
import { isAppLocale, type AppLocale } from "@/i18n/locales"
import { applyLocale } from "@/i18n/switch-locale"

export default function SettingsPage() {
  const t = useTranslations("theme")
  const s = useTranslations("settings")
  const c = useTranslations("common")
  const currentLocale = useLocale()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [language, setLanguage] = useState<AppLocale>("zh")
  const [defaultModel, setDefaultModel] = useState("gpt-4o-mini")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

  useEffect(() => {
    getSettings()
      .then((res) => {
        if (res.theme) setTheme(res.theme)
        if (isAppLocale(res.language)) setLanguage(res.language)
        if (res.defaultAiModel) setDefaultModel(res.defaultAiModel)
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [setTheme])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    setSaveFailed(false)
    try {
      await updateSettings({
        theme: theme as "light" | "dark",
        language,
        defaultAiModel: defaultModel,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      // 偏好里的语言就是「当前语言」：改完立刻整页切过去，界面、<html lang/dir>、
      // 以及后续请求都跟着变（切换器本身也是同一套逻辑）。
      if (language !== currentLocale) {
        applyLocale(language, pathname)
      }
    } catch {
      setSaveFailed(true)
      setTimeout(() => setSaveFailed(false), 3000)
    } finally {
      setIsSaving(false)
    }
  }, [theme, language, defaultModel, currentLocale, pathname])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--surface-1)] flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-[var(--text-tertiary)]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--surface-1)]">
      <div className="max-w-lg mx-auto py-8 px-4">
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/"
            aria-label={s("back")}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft className="size-4 rtl:rotate-180" />
          </Link>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">{s("title")}</h1>
        </div>

        <div className="flex flex-col gap-6">
          {/* Theme */}
          <div className="p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-0)]">
            <div className="flex items-center gap-2 mb-3">
              {theme === "dark" ? <Moon className="size-4 text-[var(--text-secondary)]" /> : <Sun className="size-4 text-[var(--text-secondary)]" />}
              <span className="text-sm font-medium text-[var(--text-primary)]">{s("theme")}</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm transition-all",
                  theme === "light"
                    ? "bg-[var(--accent)] text-[var(--surface-0)]"
                    : "border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]",
                )}
              >
                <Sun className="size-4" />
                {t("light")}
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm transition-all",
                  theme === "dark"
                    ? "bg-[var(--accent)] text-[var(--surface-0)]"
                    : "border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]",
                )}
              >
                <Moon className="size-4" />
                {t("dark")}
              </button>
            </div>
          </div>

          {/* Language — 需求：偏好设置里要有「语言」这一项，覆盖全部受支持语言 */}
          <div className="p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-0)]">
            <div className="flex items-center gap-2 mb-1">
              <Languages className="size-4 text-[var(--text-secondary)]" />
              <span className="text-sm font-medium text-[var(--text-primary)]">{s("language")}</span>
            </div>
            <p className="mb-3 text-xs text-[var(--text-tertiary)]">{s("languageHint")}</p>
            <LanguagePicker value={language} onSelect={setLanguage} />
          </div>

          {/* Default AI Model */}
          <div className="p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-0)]">
            <div className="flex items-center gap-2 mb-3">
              <Bot className="size-4 text-[var(--text-secondary)]" />
              <span className="text-sm font-medium text-[var(--text-primary)]">{s("defaultModel")}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {MODELS.map((model) => (
                <button
                  key={model}
                  type="button"
                  onClick={() => setDefaultModel(model)}
                  className={cn(
                    "px-3 py-2 rounded-xl text-xs transition-all text-start",
                    defaultModel === model
                      ? "bg-[var(--accent)] text-[var(--surface-0)]"
                      : "border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]",
                  )}
                >
                  {model}
                </button>
              ))}
            </div>
          </div>

          {/* Save */}
          <Button size="lg" onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Save className="size-4" />
                {saved ? s("saved") : saveFailed ? s("saveFailed") : c("save")}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
