"use client"

import { useState, useCallback } from "react"
import { createPortal } from "react-dom"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/Button"
import { X, Loader2, Copy } from "lucide-react"
import * as papersApi from "@/lib/api/papers"
import { useToastStore } from "@/stores/toast-store"

interface ShareDialogProps {
  open: boolean
  paperId: number | null
  onClose: () => void
}

export function ShareDialog({ open, paperId, onClose }: ShareDialogProps) {
  const t = useTranslations("papers")
  const tc = useTranslations("common")
  const [description, setDescription] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = useCallback(async () => {
    if (!paperId) return
    setIsLoading(true)
    setError(null)
    try {
      const result = await papersApi.sharePaper(paperId, description.trim() || undefined)
      await navigator.clipboard.writeText(result.shareText)
      useToastStore.getState().addToast({ message: t("shareSuccess") })
      setDescription("")
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [paperId, description, onClose, t])

  const handleClose = useCallback(() => {
    if (!isLoading) {
      setDescription("")
      setError(null)
      onClose()
    }
  }, [isLoading, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-sm mx-4 glass-surface-strong rounded-xl border border-white/10 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">{t("share")}</h3>
          <button onClick={handleClose} disabled={isLoading} className="p-1 rounded-md hover:bg-[var(--surface-2)] text-[var(--text-tertiary)] disabled:opacity-40">
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-[var(--text-secondary)]">
            {t("shareHint")}
          </p>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("shareDescriptionPlaceholder")}
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-0)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 resize-none"
            autoFocus
          />
        </div>

        {error && <p className="text-sm text-red-500 mt-3">{error}</p>}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" size="sm" onClick={handleClose} disabled={isLoading}>
            {tc("cancel")}
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="size-3.5 mr-1 animate-spin" />
                {tc("loading")}
              </>
            ) : (
              <>
                <Copy className="size-3.5 mr-1" />
                {t("shareConfirm")}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
