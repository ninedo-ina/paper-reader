"use client"

import { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/Button"
import { X, Plus, Loader2 } from "lucide-react"
import * as papersApi from "@/lib/api/papers"
import type { PaperTagDto } from "@/lib/api/types"

interface TagDialogProps {
  open: boolean
  paperId: number | null
  onClose: () => void
}

export function TagDialog({ open, paperId, onClose }: TagDialogProps) {
  const t = useTranslations("papers")
  const tc = useTranslations("common")
  const [tags, setTags] = useState<PaperTagDto[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadTags = useCallback(async () => {
    if (!paperId) return
    setIsLoading(true)
    try {
      const data = await papersApi.listPaperTags(paperId)
      setTags(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [paperId])

  useEffect(() => {
    if (open && paperId) {
      loadTags()
      setInputValue("")
      setError(null)
    }
  }, [open, paperId, loadTags])

  const handleAdd = useCallback(async () => {
    if (!paperId || !inputValue.trim()) return
    setError(null)
    try {
      const tag = await papersApi.addPaperTag(paperId, inputValue.trim())
      setTags((prev) => [...prev, tag])
      setInputValue("")
    } catch (e) {
      setError((e as Error).message)
    }
  }, [paperId, inputValue])

  const handleRemove = useCallback(async (tag: string) => {
    if (!paperId) return
    try {
      await papersApi.removePaperTag(paperId, tag)
      setTags((prev) => prev.filter((t) => t.tag !== tag))
    } catch (e) {
      setError((e as Error).message)
    }
  }, [paperId])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm mx-4 glass-surface-strong rounded-xl border border-white/10 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">{t("tags")}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-[var(--surface-2)] text-[var(--text-tertiary)]">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd() }}
            placeholder={t("tagPlaceholder")}
            className="flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--surface-0)] px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
            autoFocus
          />
          <Button size="sm" onClick={handleAdd} disabled={!inputValue.trim() || isLoading}>
            <Plus className="size-3.5" />
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="size-5 animate-spin text-[var(--text-tertiary)]" />
          </div>
        ) : tags.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)] text-center py-4">{t("noTags")}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
            {tags.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20"
              >
                {t.tag}
                <button
                  type="button"
                  onClick={() => handleRemove(t.tag)}
                  className="p-0.5 rounded-full hover:bg-[var(--accent)]/20 transition-colors"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-red-500 mt-3">{error}</p>}

        <div className="flex justify-end mt-4">
          <Button variant="secondary" size="sm" onClick={onClose}>{tc("cancel")}</Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
