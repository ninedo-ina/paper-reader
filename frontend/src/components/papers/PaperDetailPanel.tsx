"use client"

import { useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { usePaperStore } from "@/stores/paper-store"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { CATEGORIES, getCategory, type CategoryField } from "@/lib/paper-categories"
import type { Category, PaperDetailDto } from "@/lib/api/types"
import { Save, Loader2 } from "lucide-react"

interface PaperDetailPanelProps {
  paper: PaperDetailDto
  onSaved?: () => void
}

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
        <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
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

export function PaperDetailPanel({ paper, onSaved }: PaperDetailPanelProps) {
  const tp = useTranslations("papers")
  const tc = useTranslations("common")
  const tm = useTranslations("metadata")
  const tpaper = useTranslations("paper")
  const { updatePaper, error } = usePaperStore()

  const [title, setTitle] = useState(paper.title)
  const [authors, setAuthors] = useState(paper.authors || "")
  const [participants, setParticipants] = useState(paper.participants || "")
  const [abstractText, setAbstractText] = useState(paper.abstractText || "")
  const [category, setCategory] = useState<Category>(paper.category)
  const [extraFields, setExtraFields] = useState<Record<string, string>>(() => {
    const ef = paper.extraFields || {}
    const result: Record<string, string> = {}
    for (const [k, v] of Object.entries(ef)) {
      result[k] = typeof v === "string" ? v : ""
    }
    return result
  })
  const [doi, setDoi] = useState(paper.doi || "")
  const [year, setYear] = useState(paper.year?.toString() || "")
  const [journal, setJournal] = useState(paper.journal || "")
  const [isSaving, setIsSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  const catDef = getCategory(category)

  const handleFieldChange = useCallback((key: string, value: string) => {
    setExtraFields((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleCategoryChange = useCallback((newCat: Category) => {
    setCategory(newCat)
    setExtraFields({})
  }, [])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    setSavedMessage(null)
    try {
      await updatePaper(paper.id, {
        title: title.trim() || undefined,
        authors: authors.trim() || undefined,
        participants: participants.trim() || undefined,
        abstractText: abstractText.trim() || undefined,
        category,
        extraFields: Object.keys(extraFields).length > 0 ? extraFields : undefined,
        doi: doi.trim() || undefined,
        year: year.trim() || undefined,
        journal: journal.trim() || undefined,
      })
      setSavedMessage(tp("saved"))
      setTimeout(() => setSavedMessage(null), 2000)
      onSaved?.()
    } catch {
      // error in store
    } finally {
      setIsSaving(false)
    }
  }, [paper.id, title, authors, participants, abstractText, category, extraFields, doi, year, journal, updatePaper, onSaved])

  return (
    <div className="h-full flex flex-col bg-[var(--bg-root)]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)] glass-surface">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{tp("paperInfo")}</h2>
        <div className="flex items-center gap-2">
          {savedMessage && <span className="text-xs text-green-500">{savedMessage}</span>}
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            <span className="ml-1.5">{tc("save")}</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Basic Info */}
        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-2">
            {tpaper("basicInfo")}
          </legend>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--text-secondary)]">{tm("title")}</label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="--"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">{tm("authors")}</label>
              <Input
                type="text"
                value={authors}
                onChange={(e) => setAuthors(e.target.value)}
                placeholder="--"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">{tp("participants")}</label>
              <Input
                type="text"
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
                placeholder="--"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--text-secondary)]">{tm("abstract")}</label>
            <textarea
              rows={4}
              value={abstractText}
              onChange={(e) => setAbstractText(e.target.value)}
              placeholder="--"
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-0)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]/40 resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">{tm("doi")}</label>
              <Input
                type="text"
                value={doi}
                onChange={(e) => setDoi(e.target.value)}
                placeholder="--"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">{tm("year")}</label>
              <Input
                type="text"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="--"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">{tm("journal")}</label>
              <Input
                type="text"
                value={journal}
                onChange={(e) => setJournal(e.target.value)}
                placeholder="--"
              />
            </div>
          </div>
        </fieldset>

        {/* Category */}
        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-2">
            {tpaper("category")}
          </legend>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--text-secondary)]">{tpaper("category")}</label>
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value as Category)}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-0)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]/40"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          {catDef.fields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                {field.label}
                {field.required && <span className="text-red-400"> *</span>}
              </label>
              {renderField(field, extraFields[field.key] || "", (v) => handleFieldChange(field.key, v))}
            </div>
          ))}
        </fieldset>

        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </div>
  )
}
