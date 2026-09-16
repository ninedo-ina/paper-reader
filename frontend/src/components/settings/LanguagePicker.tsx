"use client"

/**
 * 语言选择器 / Language picker
 *
 * 偏好设置（设置页 + 顶栏的「偏好设置」对话框）共用这一个组件：
 * 需求要求「个人设置 → 偏好设置」里必须有「语言」这一项，并且语言要等于当前选择的语言。
 * 选项直接来自 src/i18n/locales.ts，新增语言不用改这里。
 */

import { Check } from "lucide-react"
import { useTranslations } from "next-intl"
import { LOCALES, LOCALE_META, type AppLocale } from "@/i18n/locales"
import { cn } from "@/lib/utils"

interface LanguagePickerProps {
  /** 当前选中的语言，通常是 next-intl 的 useLocale() */
  value: string
  onSelect: (locale: AppLocale) => void
  /** 列表高度类，默认适合对话框内嵌 */
  className?: string
}

export function LanguagePicker({ value, onSelect, className }: LanguagePickerProps) {
  const t = useTranslations("common")

  return (
    <div
      role="listbox"
      aria-label={t("language")}
      className={cn("grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pe-1", className)}
    >
      {LOCALES.map((code) => {
        const active = value === code
        const meta = LOCALE_META[code]
        return (
          <button
            key={code}
            type="button"
            role="option"
            aria-selected={active}
            title={meta.englishName}
            onClick={() => onSelect(code)}
            className={cn(
              "flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition-all text-start",
              active
                ? "bg-[var(--accent)] text-[var(--surface-0)]"
                : "border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]",
            )}
          >
            <span className="truncate" dir={meta.dir}>
              {meta.nativeName}
            </span>
            {active && <Check className="size-4 shrink-0" />}
          </button>
        )
      })}
    </div>
  )
}
