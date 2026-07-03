"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslations } from "next-intl"
import { useTheme } from "next-themes"
import { ArrowLeft, Sun, Moon, Languages, Bot, Save, Loader2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { getSettings, updateSettings } from "@/lib/api/settings"
import { MODELS } from "@/stores/chat-store"
import { cn } from "@/lib/utils"

export default function SettingsPage() {
  const t = useTranslations("theme")
  const c = useTranslations("common")
  const { theme, setTheme } = useTheme()
  const [language, setLanguage] = useState("zh")
  const [defaultModel, setDefaultModel] = useState("gpt-4o-mini")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getSettings()
      .then((s) => {
        if (s.theme) setTheme(s.theme)
        if (s.language) setLanguage(s.language)
        if (s.defaultAiModel) setDefaultModel(s.defaultAiModel)
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [setTheme])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      await updateSettings({
        theme: theme as "light" | "dark",
        language: language as "zh" | "en",
        defaultAiModel: defaultModel,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // silent
    } finally {
      setIsSaving(false)
    }
  }, [theme, language, defaultModel])

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
          <Link href="/" className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
            <ArrowLeft className="size-4" />
          </Link>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">Settings</h1>
        </div>

        <div className="flex flex-col gap-6">
          {/* Theme */}
          <div className="p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-0)]">
            <div className="flex items-center gap-2 mb-3">
              {theme === "dark" ? <Moon className="size-4 text-[var(--text-secondary)]" /> : <Sun className="size-4 text-[var(--text-secondary)]" />}
              <span className="text-sm font-medium text-[var(--text-primary)]">{t("light")} / {t("dark")}</span>
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

          {/* Language */}
          <div className="p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-0)]">
            <div className="flex items-center gap-2 mb-3">
              <Languages className="size-4 text-[var(--text-secondary)]" />
              <span className="text-sm font-medium text-[var(--text-primary)]">Language / 语言</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLanguage("zh")}
                className={cn(
                  "flex-1 px-4 py-2 rounded-xl text-sm transition-all",
                  language === "zh"
                    ? "bg-[var(--accent)] text-[var(--surface-0)]"
                    : "border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]",
                )}
              >
                中文
              </button>
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={cn(
                  "flex-1 px-4 py-2 rounded-xl text-sm transition-all",
                  language === "en"
                    ? "bg-[var(--accent)] text-[var(--surface-0)]"
                    : "border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]",
                )}
              >
                English
              </button>
            </div>
          </div>

          {/* Default AI Model */}
          <div className="p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-0)]">
            <div className="flex items-center gap-2 mb-3">
              <Bot className="size-4 text-[var(--text-secondary)]" />
              <span className="text-sm font-medium text-[var(--text-primary)]">Default AI Model</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {MODELS.map((model) => (
                <button
                  key={model}
                  type="button"
                  onClick={() => setDefaultModel(model)}
                  className={cn(
                    "px-3 py-2 rounded-xl text-xs transition-all text-left",
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
            ) : saved ? (
              <>
                <Save className="size-4" />
                {c("save")} Done
              </>
            ) : (
              <>
                <Save className="size-4" />
                {c("save")}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
