"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { useTranslations } from "next-intl"
import { X } from "lucide-react"
import { Button } from "@/components/ui/Button"

export interface AcademicPromptDialogProps {
  title: string
  label: string
  placeholder?: string
  initialValue?: string
  multiline?: boolean
  emptyError: string
  confirmLabel: string
  onConfirm: (value: string) => void
  onClose: () => void
}

/**
 * 公式、脚注、手动录入文献这几处都是"问一句再插进去"，共用一个输入弹层。
 * 调用方按需挂载（没有 open 属性），初始值直接进 useState —— 省掉 open 反复翻转时的状态复位逻辑。
 */
export function AcademicPromptDialog({
  title,
  label,
  placeholder,
  initialValue = "",
  multiline = false,
  emptyError,
  confirmLabel,
  onConfirm,
  onClose,
}: AcademicPromptDialogProps) {
  const tc = useTranslations("common")
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  const handleConfirm = () => {
    const trimmed = value.trim()
    if (!trimmed) {
      setError(emptyError)
      return
    }
    onConfirm(trimmed)
  }

  const fieldClass =
    "w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent)]"

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md rounded-2xl border border-[var(--border-color)] glass-surface-strong p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
          <button
            type="button"
            className="rounded-md p-1 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            onClick={onClose}
            aria-label={tc("cancel")}
          >
            <X className="size-5" />
          </button>
        </div>

        <label className="mt-4 block text-xs font-medium text-[var(--text-secondary)]" htmlFor="academic-prompt-field">
          {label}
        </label>
        {multiline ? (
          <textarea
            id="academic-prompt-field"
            className={`${fieldClass} mt-1.5 font-mono`}
            rows={3}
            value={value}
            placeholder={placeholder}
            autoFocus
            onChange={(event) => {
              setValue(event.target.value)
              setError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                handleConfirm()
              }
            }}
          />
        ) : (
          <input
            id="academic-prompt-field"
            className={`${fieldClass} mt-1.5`}
            value={value}
            placeholder={placeholder}
            autoFocus
            onChange={(event) => {
              setValue(event.target.value)
              setError(null)
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return
              event.preventDefault()
              handleConfirm()
            }}
          />
        )}

        {error && (
          <p role="alert" className="mt-2 text-sm text-red-500">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button size="sm" onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
