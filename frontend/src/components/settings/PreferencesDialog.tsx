"use client"

import { useState, useEffect } from "react"
import { useLocale, useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import { X, Search, Monitor, Bot, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { AiConfigTab } from "@/components/settings/AiConfigTab"
import { LanguagePicker } from "@/components/settings/LanguagePicker"
import { applyLocale } from "@/i18n/switch-locale"
import { saveLocalePreference } from "@/i18n/locale-preference"
import type { AppLocale } from "@/i18n/locales"

type SettingsTab = "ui" | "ai"

interface TabConfig {
  key: SettingsTab
  labelKey: string
  icon: React.ReactNode
}

const TABS: TabConfig[] = [
  { key: "ui", labelKey: "tabs.ui", icon: <Monitor className="size-4" /> },
  { key: "ai", labelKey: "tabs.ai", icon: <Bot className="size-4" /> },
]

interface PreferencesDialogProps {
  open: boolean
  onClose: () => void
  initialTab?: SettingsTab
}

export function PreferencesDialog({ open, onClose, initialTab = "ui" }: PreferencesDialogProps) {
  const t = useTranslations("preferences")
  const [activeTab, setActiveTab] = useState<SettingsTab>("ui")
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (open) setActiveTab(initialTab)
  }, [open, initialTab])

  const filteredTabs = TABS.filter((tab) =>
    t(tab.labelKey).toLowerCase().includes(search.toLowerCase()),
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[800px] h-[560px] glass-surface-strong rounded-2xl border border-[var(--border-color)] shadow-2xl flex overflow-hidden">
        {/* Left menu */}
        <div className="w-[220px] border-e border-[var(--border-subtle)] flex flex-col shrink-0">
          <div className="p-3">
            <div className="relative">
              <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[var(--text-tertiary)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] ps-7.5 pe-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>
          </div>
          <nav className="flex-1 overflow-auto px-2 pb-2 flex flex-col gap-0.5">
            {filteredTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-start",
                  activeTab === tab.key
                    ? "bg-[var(--accent)]/10 text-[var(--accent)] font-medium"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]",
                )}
              >
                <span className="shrink-0">{tab.icon}</span>
                <span className="truncate">{t(tab.labelKey)}</span>
                <ChevronRight className="ms-auto size-3.5 shrink-0 opacity-40 rtl:rotate-180" />
              </button>
            ))}
            {filteredTabs.length === 0 && (
              <p className="text-xs text-[var(--text-tertiary)] text-center py-4">{t("noMatch")}</p>
            )}
          </nav>
        </div>

        {/* Right content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)]">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              {t(TABS.find((tab) => tab.key === activeTab)?.labelKey ?? "tabs.ui")}
            </h2>
            <button
              onClick={onClose}
              aria-label={t("close")}
              className="p-1 rounded-md hover:bg-[var(--bg-hover)] transition-colors"
            >
              <X className="size-4 text-[var(--text-tertiary)]" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-5">
            {activeTab === "ui" && <UiSettingsTab />}
            {activeTab === "ai" && <AiConfigTab />}
          </div>
        </div>
      </div>
    </div>
  )
}

function UiSettingsTab() {
  const t = useTranslations("preferences")
  const locale = useLocale()
  const pathname = usePathname()

  // 偏好设置里改语言 = 立刻换语言：Cookie 管本机、账号偏好管跨设备，
  // 然后整页跳一次让 <html lang/dir> 和所有文案一起跟上（软导航换不掉根布局）。
  const handleSelect = (next: AppLocale) => {
    if (next === locale) return
    void saveLocalePreference(next)
    applyLocale(next, pathname)
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">{t("language")}</h3>
        <p className="text-xs text-[var(--text-tertiary)]">{t("languageHint")}</p>
        <LanguagePicker value={locale} onSelect={handleSelect} />
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">{t("fontSize")}</h3>
        <p className="text-xs text-[var(--text-tertiary)]">{t("fontSizeHint")}</p>
      </div>
    </div>
  )
}
