"use client"

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { useLocale, useTranslations } from "next-intl"
import { Loader2, Plus, Search, X } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { listPapers } from "@/lib/api/papers"
import type { PaperListDto } from "@/lib/api/types"
import {
  formatBibliographyEntry,
  manualCslItem,
  paperToCslItem,
  type CslItem,
} from "@/lib/citations"

export interface CitationPickerDialogProps {
  onSelect: (item: CslItem) => void
  onClose: () => void
}

/**
 * 引用面板只查论文列表（一次 100 条，够用且不需要分页），库里没有的文献走手动录入。
 * 候选项直接渲染成参考文献表里的最终样式 —— 用户点之前就能看到它会排成什么样。
 */
export function CitationPickerDialog({ onSelect, onClose }: CitationPickerDialogProps) {
  const t = useTranslations("papers")
  const tc = useTranslations("common")
  const locale = useLocale()

  const [papers, setPapers] = useState<PaperListDto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [keyword, setKeyword] = useState("")
  const [manualOpen, setManualOpen] = useState(false)
  const [manual, setManual] = useState({ title: "", authors: "", year: "", doi: "" })
  const [manualError, setManualError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    listPapers(0, 100)
      .then((page) => {
        if (ignore) return
        setPapers(page.items ?? [])
      })
      .catch(() => {
        if (ignore) return
        setLoadError(true)
      })
      .finally(() => {
        if (!ignore) setIsLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  const results = useMemo(() => {
    const needle = keyword.trim().toLowerCase()
    if (!needle) return papers
    return papers.filter((paper) =>
      [paper.title, paper.authors, paper.doi, paper.journal]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle)),
    )
  }, [keyword, papers])

  const submitManual = () => {
    if (!manual.title.trim()) {
      setManualError(t("citationManualTitleRequired"))
      return
    }
    onSelect(
      manualCslItem({
        title: manual.title,
        authors: manual.authors,
        year: manual.year,
        doi: manual.doi,
      }),
    )
  }

  const fieldClass =
    "w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent)]"

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("citationPickerTitle")}
        className="relative flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-[var(--border-color)] glass-surface-strong p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            {t("citationPickerTitle")}
          </h3>
          <button
            type="button"
            className="rounded-md p-1 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            onClick={onClose}
            aria-label={tc("cancel")}
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            className={`${fieldClass} pl-9`}
            value={keyword}
            placeholder={t("citationPickerSearch")}
            autoFocus
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>

        <div className="mt-3 min-h-24 flex-1 overflow-y-auto">
          {isLoading ? (
            <p className="flex items-center justify-center gap-2 py-6 text-sm text-[var(--text-tertiary)]">
              <Loader2 className="size-4 animate-spin" />
              {tc("loading")}
            </p>
          ) : loadError ? (
            <p role="alert" className="py-6 text-center text-sm text-red-500">
              {tc("error")}
            </p>
          ) : results.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--text-tertiary)]">
              {t("citationPickerEmpty")}
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {results.map((paper) => {
                const item = paperToCslItem(paper)
                return (
                  <li key={paper.id}>
                    <button
                      type="button"
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                      onClick={() => onSelect(item)}
                    >
                      {formatBibliographyEntry(item, locale)}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {manualOpen ? (
          <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
            <input
              className={fieldClass}
              value={manual.title}
              placeholder={t("citationManualTitle")}
              onChange={(event) => {
                setManual({ ...manual, title: event.target.value })
                setManualError(null)
              }}
            />
            <input
              className={`${fieldClass} mt-2`}
              value={manual.authors}
              placeholder={t("citationManualAuthors")}
              onChange={(event) => setManual({ ...manual, authors: event.target.value })}
            />
            <div className="mt-2 flex gap-2">
              <input
                className={fieldClass}
                value={manual.year}
                placeholder={t("citationManualYear")}
                onChange={(event) => setManual({ ...manual, year: event.target.value })}
              />
              <input
                className={fieldClass}
                value={manual.doi}
                placeholder={t("citationManualDoi")}
                onChange={(event) => setManual({ ...manual, doi: event.target.value })}
              />
            </div>
            {manualError && (
              <p role="alert" className="mt-2 text-sm text-red-500">
                {manualError}
              </p>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setManualOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button size="sm" onClick={submitManual}>
                {t("academicInsert")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
            <Button variant="ghost" size="sm" onClick={() => setManualOpen(true)}>
              <Plus className="mr-1.5 size-3.5" />
              {t("citationPickerManual")}
            </Button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
