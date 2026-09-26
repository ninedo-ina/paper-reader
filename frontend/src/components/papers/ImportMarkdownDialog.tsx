"use client"

import { useCallback, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/Button"
import { X, Loader2, FileUp, Upload } from "lucide-react"

interface ImportMarkdownDialogProps {
  open: boolean
  onClose: () => void
  /** 把 Markdown 交给上层：转换为 HTML 并加载进编辑器。抛错则在弹层内提示。 */
  onSubmit: (markdown: string) => Promise<void>
}

export function ImportMarkdownDialog({ open, onClose, onSubmit }: ImportMarkdownDialogProps) {
  const t = useTranslations("import")
  const c = useTranslations("common")
  const [markdown, setMarkdown] = useState("")
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const handleClose = useCallback(() => {
    if (importing) return
    setMarkdown("")
    setError(null)
    onClose()
  }, [importing, onClose])

  const handleFile = useCallback(async (file: File | undefined) => {
    if (!file) return
    const text = await file.text()
    setMarkdown(text)
    setError(null)
  }, [])

  const handleImport = useCallback(async () => {
    if (!markdown.trim()) {
      setError(t("empty"))
      return
    }
    setImporting(true)
    setError(null)
    try {
      await onSubmit(markdown)
      setMarkdown("")
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setImporting(false)
    }
  }, [markdown, onSubmit, onClose, t])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative glass-surface-strong rounded-xl border border-white/10 w-full max-w-lg mx-4 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t("importMarkdown")}</h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={importing}
            className="p-1 rounded-md hover:bg-[var(--surface-2)] text-[var(--text-tertiary)] disabled:opacity-40"
            aria-label={c("cancel")}
          >
            <X className="size-5" />
          </button>
        </div>

        <p className="text-xs text-[var(--text-tertiary)] mb-3">{t("pasteHint")}</p>

        <div className="space-y-3">
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".md,.markdown,text/markdown"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
            >
              <FileUp className="size-4 mr-1.5" />
              {t("chooseFile")}
            </Button>
          </div>

          <textarea
            rows={10}
            value={markdown}
            disabled={importing}
            onChange={(e) => setMarkdown(e.target.value)}
            placeholder={t("placeholder")}
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-0)] px-3 py-2 text-sm font-mono text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]/40 resize-y"
          />
        </div>

        <div className="flex justify-end gap-2 pt-5">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={importing}>
            {c("cancel")}
          </Button>
          <Button type="button" onClick={handleImport} disabled={importing || !markdown.trim()}>
            {importing ? (
              <>
                <Loader2 className="size-4 mr-1.5 animate-spin" />
                {t("importing")}
              </>
            ) : (
              <>
                <Upload className="size-4 mr-1.5" />
                {t("preview")}
              </>
            )}
          </Button>
        </div>

        {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
      </div>
    </div>
  )
}
