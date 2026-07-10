"use client"

import { useState, useRef, useCallback } from "react"
import { useTranslations } from "next-intl"
import { usePaperStore } from "@/stores/paper-store"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { X, Upload, Link, Loader2 } from "lucide-react"

interface UploadDialogProps {
  open: boolean
  onClose: () => void
  onUploaded?: () => void
}

type Tab = "file" | "url"

export function UploadDialog({ open, onClose, onUploaded }: UploadDialogProps) {
  const t = useTranslations("reader")
  const c = useTranslations("common")
  const { uploadPdf, uploadFromUrl, error } = usePaperStore()
  const [tab, setTab] = useState<Tab>("file")
  const [url, setUrl] = useState("")
  const [urlTitle, setUrlTitle] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      setIsUploading(true)
      try {
        await uploadPdf(file)
        onUploaded?.()
        onClose()
      } catch {
        // error in store
      } finally {
        setIsUploading(false)
      }
    },
    [uploadPdf, onUploaded, onClose],
  )

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (!file || file.type !== "application/pdf") return
      setIsUploading(true)
      try {
        await uploadPdf(file)
        onUploaded?.()
        onClose()
      } catch {
        // error in store
      } finally {
        setIsUploading(false)
      }
    },
    [uploadPdf, onUploaded, onClose],
  )

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url) return
    setIsUploading(true)
    try {
      await uploadFromUrl(url, urlTitle || undefined)
      onUploaded?.()
      onClose()
    } catch {
      // error in store
    } finally {
      setIsUploading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-surface-strong rounded-xl border border-white/10 w-full max-w-lg mx-4 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {t("uploadPdf")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[var(--surface-2)] text-[var(--text-tertiary)]"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--border-color)] mb-4">
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === "file"
                ? "border-[var(--accent)] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            }`}
            onClick={() => setTab("file")}
          >
            <Upload className="size-4 inline mr-1.5" />
            PDF File
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === "url"
                ? "border-[var(--accent)] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            }`}
            onClick={() => setTab("url")}
          >
            <Link className="size-4 inline mr-1.5" />
            URL
          </button>
        </div>

        {tab === "file" ? (
          <div
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
              isDragging
                ? "border-[var(--accent)] bg-[var(--surface-2)]"
                : "border-[var(--border-color)]"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter") fileInputRef.current?.click() }}
          >
            <Upload className="size-8 text-[var(--text-tertiary)] mb-2" />
            <p className="text-sm text-[var(--text-secondary)]">
              {t("dragOrClick")}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
            {isUploading && <Loader2 className="size-6 mt-2 animate-spin text-[var(--accent)]" />}
          </div>
        ) : (
          <form onSubmit={handleUrlSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="url">{t("openUrl")}</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://example.com/paper.pdf"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="urlTitle">Title (optional)</Label>
              <Input
                id="urlTitle"
                type="text"
                placeholder="Paper title"
                value={urlTitle}
                onChange={(e) => setUrlTitle(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={isUploading || !url} className="w-full">
              {isUploading ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  {c("loading")}
                </>
              ) : (
                t("openUrl")
              )}
            </Button>
          </form>
        )}

        {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
      </div>
    </div>
  )
}
