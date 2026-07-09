"use client"

import { useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { usePaperStore } from "@/stores/paper-store"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { X, Loader2 } from "lucide-react"

interface CreatePaperDialogProps {
  open: boolean
  onClose: () => void
}

export function CreatePaperDialog({ open, onClose }: CreatePaperDialogProps) {
  const t = useTranslations("reader")
  const c = useTranslations("common")
  const { createPaper, error } = usePaperStore()
  const [title, setTitle] = useState("")
  const [authors, setAuthors] = useState("")
  const [participants, setParticipants] = useState("")
  const [abstract, setAbstract] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!title.trim()) return
      setIsCreating(true)
      try {
        await createPaper({
          title: title.trim(),
          authors: authors.trim() || undefined,
          participants: participants.trim() || undefined,
          abstractText: abstract.trim() || undefined,
        })
        onClose()
        setTitle("")
        setAuthors("")
        setParticipants("")
        setAbstract("")
      } catch {
        // error in store
      } finally {
        setIsCreating(false)
      }
    },
    [title, authors, participants, abstract, createPaper, onClose],
  )

  const handleClose = useCallback(() => {
    if (!isCreating) {
      setTitle("")
      setAuthors("")
      setParticipants("")
      setAbstract("")
      onClose()
    }
  }, [isCreating, onClose])

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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="cpTitle" className="text-sm font-medium text-[var(--text-secondary)]">
              {t("paperTitle")} <span className="text-red-400">*</span>
            </label>
            <Input
              id="cpTitle"
              type="text"
              placeholder={t("paperTitlePlaceholder")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cpAuthors" className="text-sm font-medium text-[var(--text-secondary)]">
              {t("paperAuthors")}
            </label>
            <Input
              id="cpAuthors"
              type="text"
              placeholder={t("paperAuthorsPlaceholder")}
              value={authors}
              onChange={(e) => setAuthors(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cpParticipants" className="text-sm font-medium text-[var(--text-secondary)]">
              {t("paperParticipants")}
            </label>
            <Input
              id="cpParticipants"
              type="text"
              placeholder={t("paperParticipantsPlaceholder")}
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cpAbstract" className="text-sm font-medium text-[var(--text-secondary)]">
              {t("paperAbstract")}
            </label>
            <textarea
              id="cpAbstract"
              rows={4}
              placeholder={t("paperAbstractPlaceholder")}
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-0)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]/40 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={handleClose} disabled={isCreating}>
              {c("cancel")}
            </Button>
            <Button type="submit" disabled={isCreating || !title.trim()}>
              {isCreating ? (
                <>
                  <Loader2 className="size-4 mr-1.5 animate-spin" />
                  {t("creating")}
                </>
              ) : (
                t("createPaper")
              )}
            </Button>
          </div>
        </form>

        {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
      </div>
    </div>
  )
}
