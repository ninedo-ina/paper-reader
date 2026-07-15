"use client"

import { useState, useCallback, useEffect } from "react"
import { useTranslations } from "next-intl"
import { usePaperStore } from "@/stores/paper-store"
import { useStorageStore } from "@/stores/storage-store"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { CATEGORIES, getCategory, type CategoryField } from "@/lib/paper-categories"
import type { Category, CreatePaperRequest } from "@/lib/api/types"
import { X, Loader2, ChevronLeft, ChevronRight } from "lucide-react"

interface CreatePaperDialogProps {
  open: boolean
  onClose: () => void
}

const STEPS = [
  { key: "basic", label: "基本信息", labelEn: "Basic Info" },
  { key: "fields", label: "分类字段", labelEn: "Category Fields" },
  { key: "storage", label: "存储配置", labelEn: "Storage" },
]

function renderField(field: CategoryField, value: string, onChange: (v: string) => void) {
  switch (field.type) {
    case "textarea":
      return (
        <textarea
          rows={3}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-0)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]/40 resize-none"
        />
      )
    case "select":
      return (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-0)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]/40"
        >
          <option value="">--</option>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )
    case "date":
      return (
        <Input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    default:
      return (
        <Input
          type="text"
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )
  }
}

export function CreatePaperDialog({ open, onClose }: CreatePaperDialogProps) {
  const t = useTranslations("reader")
  const c = useTranslations("common")
  const { createPaper, error } = usePaperStore()
  const { configs, loadConfigs } = useStorageStore()

  const [step, setStep] = useState(0)
  const [title, setTitle] = useState("")
  const [authors, setAuthors] = useState("")
  const [abstract, setAbstract] = useState("")
  const [category, setCategory] = useState<Category>("JOURNAL")
  const [extraFields, setExtraFields] = useState<Record<string, string>>({})
  const [storageConfigId, setStorageConfigId] = useState<number | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const catDef = getCategory(category)

  useEffect(() => {
    if (open) {
      loadConfigs()
    }
  }, [open, loadConfigs])

  const reset = useCallback(() => {
    setStep(0)
    setTitle("")
    setAuthors("")
    setAbstract("")
    setCategory("JOURNAL")
    setExtraFields({})
    setStorageConfigId(null)
  }, [])

  const handleClose = useCallback(() => {
    if (!isCreating) {
      reset()
      onClose()
    }
  }, [isCreating, reset, onClose])

  const handleFieldChange = useCallback((key: string, value: string) => {
    setExtraFields((prev) => ({ ...prev, [key]: value }))
  }, [])

  const canNext = (() => {
    if (step === 0) return title.trim().length > 0 && category.length > 0
    if (step === 1) {
      return catDef.fields.filter((f) => f.required).every((f) => extraFields[f.key]?.trim())
    }
    return true
  })()

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) return
    setIsCreating(true)
    try {
      const data: CreatePaperRequest = {
        title: title.trim(),
        authors: authors.trim() || undefined,
        abstractText: abstract.trim() || undefined,
        category,
        extraFields: Object.keys(extraFields).length > 0 ? extraFields : undefined,
        storageConfigId: storageConfigId ?? undefined,
      }
      await createPaper(data)
      reset()
      onClose()
    } catch {
      // error in store
    } finally {
      setIsCreating(false)
    }
  }, [title, authors, abstract, category, extraFields, storageConfigId, createPaper, reset, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative glass-surface-strong rounded-xl border border-white/10 w-full max-w-lg mx-4 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {t("createPaper")}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={isCreating}
            className="p-1 rounded-md hover:bg-[var(--surface-2)] text-[var(--text-tertiary)] disabled:opacity-40"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-6">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2 flex-1">
              <div
                className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium border transition-colors ${
                  i <= step
                    ? "bg-[var(--accent)] border-[var(--accent)] text-[var(--surface-1)]"
                    : "border-[var(--border-color)] text-[var(--text-tertiary)]"
                }`}
              >
                {i + 1}
              </div>
              <span className={`text-xs ${i <= step ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"}`}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && <div className="flex-1 h-px bg-[var(--border-color)]" />}
            </div>
          ))}
        </div>

        {/* Step 0: Basic Info */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                {t("paperTitle")} <span className="text-red-400">*</span>
              </label>
              <Input
                type="text"
                placeholder={t("paperTitlePlaceholder")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                {t("paperAuthors")}
              </label>
              <Input
                type="text"
                placeholder={t("paperAuthorsPlaceholder")}
                value={authors}
                onChange={(e) => setAuthors(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                {t("paperCategory") || "分类"} <span className="text-red-400">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value as Category)
                  setExtraFields({})
                }}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-0)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]/40"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                {t("paperAbstract")}
              </label>
              <textarea
                rows={4}
                placeholder={t("paperAbstractPlaceholder")}
                value={abstract}
                onChange={(e) => setAbstract(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-0)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]/40 resize-none"
              />
            </div>
          </div>
        )}

        {/* Step 1: Category-specific fields */}
        {step === 1 && (
          <div className="space-y-4 max-h-72 overflow-y-auto">
            <p className="text-sm text-[var(--text-tertiary)]">{catDef.label} — 特有字段</p>
            {catDef.fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--text-secondary)]">
                  {field.label}
                  {field.required && <span className="text-red-400"> *</span>}
                </label>
                {renderField(field, extraFields[field.key] || "", (v) => handleFieldChange(field.key, v))}
              </div>
            ))}
          </div>
        )}

        {/* Step 2: Storage Config */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-tertiary)]">
              选择论文存储位置（可选）
            </p>
            {configs.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)] text-center py-4">
                暂无存储配置，可在设置中创建
              </p>
            ) : (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--text-secondary)]">
                  存储配置
                </label>
                <select
                  value={storageConfigId ?? ""}
                  onChange={(e) => setStorageConfigId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-0)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]/40"
                >
                  <option value="">不使用存储</option>
                  {configs.map((cfg) => (
                    <option key={cfg.id} value={cfg.id}>
                      {cfg.name} ({cfg.storageType})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between gap-2 pt-6">
          <div>
            {step > 0 && (
              <Button type="button" variant="secondary" onClick={() => setStep(step - 1)} disabled={isCreating}>
                <ChevronLeft className="size-4 mr-1" />
                {c("cancel") || "返回"}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={() => setStep(step + 1)} disabled={!canNext}>
                {c("confirm") || "下一步"}
                <ChevronRight className="size-4 ml-1" />
              </Button>
            ) : (
              <Button type="button" onClick={handleSubmit} disabled={isCreating || !title.trim()}>
                {isCreating ? (
                  <>
                    <Loader2 className="size-4 mr-1.5 animate-spin" />
                    {t("creating")}
                  </>
                ) : (
                  t("createPaper")
                )}
              </Button>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
      </div>
    </div>
  )
}
