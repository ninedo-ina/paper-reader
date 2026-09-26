"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useTranslations } from "next-intl"
import { usePaperStore } from "@/stores/paper-store"
import { getUploadQuota } from "@/lib/api/papers"
import { formatFileSize } from "@/lib/utils"
import type { UploadQuotaDto } from "@/lib/api/types"
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

/**
 * 单文件上限的本地副本，只为在选中文件的瞬间给出提示，省掉一次必然失败的上传。
 * 真正的判定在服务端（UploadQuotaService.MAX_FILE_BYTES），超限返回 1009。
 */
const MAX_FILE_BYTES = 10 * 1024 * 1024

export function UploadDialog({ open, onClose, onUploaded }: UploadDialogProps) {
  const t = useTranslations("reader")
  const c = useTranslations("common")
  const { uploadPdf, uploadFromUrl } = usePaperStore()
  const [tab, setTab] = useState<Tab>("file")
  const [url, setUrl] = useState("")
  const [urlTitle, setUrlTitle] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  // 上传失败时 store 里的论文列表不会变，也不会写 error —— 失败信息只能由弹窗自己拿着。
  const [error, setError] = useState<string | null>(null)
  const [quota, setQuota] = useState<UploadQuotaDto | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    let cancelled = false
    getUploadQuota()
      .then((q) => { if (!cancelled) setQuota(q) })
      .catch(() => { /* 读不到配额就不显示提示，上传时服务端照样会拦 */ })
    return () => { cancelled = true }
  }, [open])

  /** 选文件时先自查一遍大小，避免白传一个 10MB+ 的文件上去等 413。 */
  const rejectIfTooLarge = useCallback(
    (file: File): boolean => {
      if (file.size <= MAX_FILE_BYTES) return false
      setError(t("fileTooLarge", {
        size: formatFileSize(file.size),
        limit: formatFileSize(MAX_FILE_BYTES),
      }))
      return true
    },
    [t],
  )

  const describeFailure = useCallback(
    (e: unknown) => {
      const message = (e as { message?: string } | null)?.message
      return message || t("uploadFailed")
    },
    [t],
  )

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      setError(null)
      if (rejectIfTooLarge(file)) {
        // 清空 value，否则再次选中同一个文件不会触发 change，提示看起来像没反应。
        e.target.value = ""
        return
      }
      setIsUploading(true)
      try {
        await uploadPdf(file)
        onUploaded?.()
        onClose()
      } catch (err) {
        setError(describeFailure(err))
      } finally {
        setIsUploading(false)
      }
    },
    [uploadPdf, onUploaded, onClose, rejectIfTooLarge, describeFailure],
  )

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (!file || file.type !== "application/pdf") return
      setError(null)
      if (rejectIfTooLarge(file)) return
      setIsUploading(true)
      try {
        await uploadPdf(file)
        onUploaded?.()
        onClose()
      } catch (err) {
        setError(describeFailure(err))
      } finally {
        setIsUploading(false)
      }
    },
    [uploadPdf, onUploaded, onClose, rejectIfTooLarge, describeFailure],
  )

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url) return
    setError(null)
    setIsUploading(true)
    try {
      await uploadFromUrl(url, urlTitle || undefined)
      onUploaded?.()
      onClose()
    } catch (err) {
      setError(describeFailure(err))
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

        {/* 限额对两种上传方式都成立（URL 导入也是把 PDF 落到服务器），所以放在 Tab 外面 */}
        <div className="mb-4 space-y-1 text-xs text-[var(--text-tertiary)]">
          <p>{t("fileLimitHint", { limit: formatFileSize(MAX_FILE_BYTES) })}</p>
          {quota && (
            <p>
              {t("quotaRemaining", {
                daily: formatFileSize(quota.dailyRemainingBytes),
                total: formatFileSize(quota.totalRemainingBytes),
              })}
            </p>
          )}
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
              <Label htmlFor="urlTitle">{t("urlTitleOptional")}</Label>
              <Input
                id="urlTitle"
                type="text"
                placeholder={t("paperTitlePlaceholder")}
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

        {error && <p role="alert" className="text-sm text-red-500 mt-3">{error}</p>}
      </div>
    </div>
  )
}
