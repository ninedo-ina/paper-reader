"use client"

import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { useTranslations } from "next-intl"
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/Button"

interface DeletePaperDialogProps {
  open: boolean
  paperTitle: string
  hasOriginalFile: boolean
  onClose: () => void
  onConfirm: (deleteFile: boolean) => Promise<void>
}

export function DeletePaperDialog({
  open,
  paperTitle,
  hasOriginalFile,
  onClose,
  onConfirm,
}: DeletePaperDialogProps) {
  const t = useTranslations("papers")
  const tc = useTranslations("common")
  const [deleteFile, setDeleteFile] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setDeleteFile(false)
    setError(null)
  }, [])

  useEffect(() => {
    if (open) reset()
  }, [open, reset])

  const handleClose = useCallback(() => {
    if (isDeleting) return
    reset()
    onClose()
  }, [isDeleting, onClose, reset])

  const handleConfirm = useCallback(async () => {
    setIsDeleting(true)
    setError(null)
    try {
      await onConfirm(deleteFile && hasOriginalFile)
      reset()
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("deleteFailed"))
    } finally {
      setIsDeleting(false)
    }
  }, [deleteFile, hasOriginalFile, onClose, onConfirm, reset, t])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleClose, open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={handleClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-paper-title"
        aria-describedby="delete-paper-description"
        className="relative w-full max-w-md rounded-2xl border border-[var(--border-color)] glass-surface-strong p-6 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-500">
            <AlertTriangle className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="delete-paper-title" className="text-base font-semibold text-[var(--text-primary)]">
              {t("deleteTitle")}
            </h2>
            <p className="mt-1 break-words text-sm font-medium text-[var(--text-primary)]">
              {t("deleteConfirm", { title: paperTitle || "Untitled" })}
            </p>
            <p id="delete-paper-description" className="mt-1.5 text-sm leading-5 text-[var(--text-secondary)]">
              {t("deleteDescription")}
            </p>
          </div>
          <button
            type="button"
            aria-label={tc("cancel")}
            onClick={handleClose}
            disabled={isDeleting}
            className="rounded-md p-1 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-40"
          >
            <X className="size-5" />
          </button>
        </div>

        {hasOriginalFile ? (
          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)]/70 p-3.5 transition-colors hover:border-red-500/30">
            <input
              type="checkbox"
              checked={deleteFile}
              onChange={(event) => setDeleteFile(event.target.checked)}
              disabled={isDeleting}
              className="mt-0.5 size-4 shrink-0 accent-red-500"
            />
            <span>
              <span className="block text-sm font-medium text-[var(--text-primary)]">
                {t("deleteOriginalFile")}
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-[var(--text-tertiary)]">
                {deleteFile ? t("deleteOriginalFileHint") : t("deleteRecordOnlyHint")}
              </span>
            </span>
          </label>
        ) : (
          <p className="mt-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)]/70 p-3 text-xs leading-5 text-[var(--text-tertiary)]">
            {t("noOriginalFile")}
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-500">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={handleClose} disabled={isDeleting}>
            {tc("cancel")}
          </Button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="inline-flex h-7 items-center justify-center rounded-lg bg-red-500 px-3 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                {t("deleting")}
              </>
            ) : (
              <>
                <Trash2 className="mr-1.5 size-3.5" />
                {tc("delete")}
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
