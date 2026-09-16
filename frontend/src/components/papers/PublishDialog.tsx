"use client"

import { useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { createVersion } from "@/lib/api/versions"
import type { CreateVersionRequest, PaperVersionDto } from "@/lib/api/types"
import { X, Loader2, Upload } from "lucide-react"

interface PublishDialogProps {
  open: boolean
  paperId: number
  onClose: () => void
  onPublished: (version: PaperVersionDto) => void
}

export function PublishDialog({ open, paperId, onClose, onPublished }: PublishDialogProps) {
  const c = useTranslations("common")
  const t = useTranslations("paper")
  const [version, setVersion] = useState("")
  const [remark, setRemark] = useState("")
  const [isPublishing, setIsPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setVersion("")
    setRemark("")
    setError(null)
  }, [])

  const handleClose = useCallback(() => {
    if (!isPublishing) {
      reset()
      onClose()
    }
  }, [isPublishing, reset, onClose])

  const handlePublish = useCallback(async () => {
    if (!version.trim()) return
    setIsPublishing(true)
    setError(null)
    try {
      const data: CreateVersionRequest = {
        version: version.trim(),
        remark: remark.trim() || undefined,
      }
      const result = await createVersion(paperId, data)
      reset()
      onClose()
      onPublished(result)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setIsPublishing(false)
    }
  }, [version, remark, paperId, reset, onClose, onPublished])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative glass-surface-strong rounded-xl border border-white/10 w-full max-w-md mx-4 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t("publishVersion")}</h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={isPublishing}
            className="p-1 rounded-md hover:bg-[var(--surface-2)] text-[var(--text-tertiary)] disabled:opacity-40"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--text-secondary)]">
              {t("versionNumber")} <span className="text-red-400">*</span>
            </label>
            <Input
              type="text"
              placeholder={t("versionNumberPlaceholder")}
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--text-secondary)]">{t("versionRemark")}</label>
            <textarea
              rows={3}
              placeholder={t("versionRemarkPlaceholder")}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-0)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]/40 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-6">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isPublishing}>
            {c("cancel")}
          </Button>
          <Button type="button" onClick={handlePublish} disabled={isPublishing || !version.trim()}>
            {isPublishing ? (
              <>
                <Loader2 className="size-4 mr-1.5 animate-spin" />
                {t("publishing")}
              </>
            ) : (
              <>
                <Upload className="size-4 mr-1.5" />
                {t("publish")}
              </>
            )}
          </Button>
        </div>

        {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
      </div>
    </div>
  )
}
