"use client"

import { useEffect, useRef, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import { Check, Languages } from "lucide-react"
import { LOCALES, LOCALE_META, isAppLocale, type AppLocale } from "@/i18n/locales"
import { applyLocale } from "@/i18n/switch-locale"
import { saveLocalePreference } from "@/i18n/locale-preference"
import { useAuthStore } from "@/stores/auth-store"
import { cn } from "@/lib/utils"

/**
 * 语言切换下拉 / Language switcher dropdown
 *
 * 点按钮弹出语言列表，选中后写 Cookie 并整页跳到同一页面的新语言地址。
 * 已登录时顺带把语言写回用户偏好设置，保证「个人设置 → 偏好设置 → 语言」和界面一致。
 */
export function LanguageSwitcher() {
  const locale = useLocale()
  const t = useTranslations("common")
  const pathname = usePathname()
  const accessToken = useAuthStore((s) => s.accessToken)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const current: AppLocale = isAppLocale(locale) ? locale : "zh"

  const select = (next: AppLocale) => {
    setOpen(false)
    if (next === current) return
    applyLocale(next, pathname)
    // 未登录时不动用户偏好：偏好要等登录成功后再写（LoginForm 负责那次写入）
    if (accessToken) void saveLocalePreference(next)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-all duration-150 hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
        aria-label={t("switchLanguage")}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={t("switchLanguage")}
      >
        <Languages className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t("language")}
          // scrollbar-hidden：14 种语言超出 max-h-80，要能滚但不要露出滚动条
          className="scrollbar-hidden absolute end-0 top-10 z-50 max-h-80 w-56 overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--surface-0)] py-1 shadow-[var(--shadow-md)]"
        >
          {LOCALES.map((code) => {
            const active = code === current
            return (
              <button
                key={code}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => select(code)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 px-3 py-2 text-start text-sm transition-colors",
                  active
                    ? "bg-[var(--accent-soft)] text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]",
                )}
              >
                <span className="flex flex-col items-start">
                  <span lang={code}>{LOCALE_META[code].nativeName}</span>
                  <span className="text-xs text-[var(--text-tertiary)]">
                    {LOCALE_META[code].englishName}
                  </span>
                </span>
                {active && <Check className="h-4 w-4 shrink-0 text-[var(--accent)]" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
