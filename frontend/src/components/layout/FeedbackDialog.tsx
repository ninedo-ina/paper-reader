"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { usePathname } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { ImagePlus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { submitFeedback } from "@/lib/api/feedback"

/** 与后端 FeedbackService 的闸门保持一致；这里先拦一道，省去一次白跑的请求 */
const MAX_SCREENSHOTS = 3
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"]

/** 构建时由 next.config 从 frontend/VERSION 注入 */
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "dev"

interface Shot {
  file: File
  /** data URL，仅用于弹窗里的缩略图；不上传 */
  preview: string
}

function readPreview(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => resolve("")
    reader.readAsDataURL(file)
  })
}

export function FeedbackDialog() {
  const t = useTranslations("feedback")
  const locale = useLocale()
  const pathname = usePathname()

  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [shots, setShots] = useState<Shot[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const titleRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // 张数上限与去重都要看当前值，而加图是异步的（读 data URL），所以另存一份同步的镜像
  const shotsRef = useRef<Shot[]>([])

  useEffect(() => setMounted(true), [])

  const close = useCallback(() => setOpen(false), [])

  const applyShots = useCallback((next: Shot[]) => {
    shotsRef.current = next
    setShots(next)
  }, [])

  const addFiles = useCallback(
    async (incoming: File[]) => {
      const room = MAX_SCREENSHOTS - shotsRef.current.length
      const usable = incoming.filter(
        (file) => ACCEPTED_TYPES.includes(file.type) && file.size <= MAX_SCREENSHOT_BYTES,
      )
      const taken = usable.slice(0, Math.max(room, 0))
      if (taken.length < incoming.length) setNotice(t("screenshotRejected"))
      else setNotice(null)
      if (taken.length === 0) return

      const added = await Promise.all(
        taken.map(async (file) => ({ file, preview: await readPreview(file) })),
      )
      applyShots([...shotsRef.current, ...added])
    },
    [applyShots, t],
  )

  // 弹窗开着时，粘到哪儿都算：不只贴在输入框里，贴到弹窗任意位置都能收下截图
  useEffect(() => {
    if (!open) return
    const onPaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items) return
      const files: File[] = []
      for (const item of items) {
        if (!item.type.startsWith("image/")) continue
        const file = item.getAsFile()
        if (file) files.push(file)
      }
      if (files.length === 0) return
      event.preventDefault()
      void addFiles(files)
    }
    document.addEventListener("paste", onPaste)
    return () => document.removeEventListener("paste", onPaste)
  }, [open, addFiles])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) close()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, close])

  // 打开时进场动画 + 聚焦标题；关闭时把整张表单清干净，下次打开是空的
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setVisible(true))
      setTimeout(() => titleRef.current?.focus(), 50)
      return
    }
    setVisible(false)
    setTitle("")
    setContent("")
    applyShots([])
    setNotice(null)
    setError(null)
    setSending(false)
    setSent(false)
  }, [open, applyShots])

  // 成功提示留一会儿自己关掉，用户不用再点一次
  useEffect(() => {
    if (!sent) return
    const timer = setTimeout(() => setOpen(false), 1600)
    return () => clearTimeout(timer)
  }, [sent])

  const removeShot = (index: number) => {
    applyShots(shotsRef.current.filter((_, i) => i !== index))
    setNotice(null)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const cleanTitle = title.trim()
    const cleanContent = content.trim()
    if (!cleanTitle) {
      setError(t("titleRequired"))
      return
    }
    if (!cleanContent) {
      setError(t("contentRequired"))
      return
    }

    setError(null)
    setSending(true)
    try {
      await submitFeedback(
        {
          title: cleanTitle,
          content: cleanContent,
          pagePath: pathname ?? "",
          appVersion: APP_VERSION,
          locale,
        },
        shotsRef.current.map((shot) => shot.file),
      )
      setSent(true)
    } catch {
      setError(t("failed"))
    } finally {
      setSending(false)
    }
  }

  const overlay =
    open && mounted ? (
      <div
        className={cn(
          "fixed inset-0 z-[9999] flex items-start justify-center pt-[14vh]",
          "bg-black/40 backdrop-blur-md",
          "transition-opacity duration-200",
          visible ? "opacity-100" : "opacity-0",
        )}
        onClick={close}
      >
        <div
          onClick={(event) => event.stopPropagation()}
          className={cn(
            "w-full max-w-lg mx-4 rounded-2xl border border-[var(--border-subtle)]",
            "bg-[var(--surface-0)] shadow-2xl overflow-hidden",
            "transition-all duration-200",
            visible ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 -translate-y-2",
          )}
        >
          <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-1">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                {t("title")}
              </h2>
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                {sent ? t("success") : t("subtitle")}
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label={t("close")}
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>

          {sent ? (
            <div className="px-5 pb-6 pt-4">
              <button
                type="button"
                onClick={close}
                className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--surface-0)] transition-opacity hover:opacity-90"
              >
                {t("close")}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="px-5 pb-5 pt-4 space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  {t("titleLabel")}
                </span>
                <input
                  ref={titleRef}
                  type="text"
                  value={title}
                  maxLength={200}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={t("titlePlaceholder")}
                  className="mt-1.5 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-placeholder)] focus:ring-1 focus:ring-[var(--accent)]"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  {t("contentLabel")}
                </span>
                <textarea
                  value={content}
                  maxLength={5000}
                  rows={5}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder={t("contentPlaceholder")}
                  className="mt-1.5 w-full resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-placeholder)] focus:ring-1 focus:ring-[var(--accent)]"
                />
              </label>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    {t("screenshotLabel")}
                  </span>
                  <span className="text-xs text-[var(--text-tertiary)]">
                    {t("screenshotLimit")}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {shots.map((shot, index) => (
                    <div
                      key={`${shot.file.name}-${index}`}
                      className="relative size-16 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)]"
                    >
                      {/* 本地预览，data URL 不过网络 */}
                      <img src={shot.preview} alt="" className="size-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeShot(index)}
                        aria-label={t("screenshotRemove")}
                        className="absolute end-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                  {shots.length < MAX_SCREENSHOTS && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label={t("screenshotAdd")}
                      className="flex size-16 items-center justify-center rounded-lg border border-dashed border-[var(--border-color)] text-[var(--text-tertiary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text-secondary)]"
                    >
                      <ImagePlus className="size-4" />
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_TYPES.join(",")}
                    multiple
                    hidden
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? [])
                      // 清空 value，否则连选两次同一张图不会再触发 change
                      event.target.value = ""
                      if (files.length > 0) void addFiles(files)
                    }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-[var(--text-tertiary)]">
                  {t("screenshotHint")}
                </p>
                {notice && <p className="mt-1 text-xs text-red-500">{notice}</p>}
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--surface-0)] transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {sending ? t("submitting") : t("submit")}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    ) : null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("button")}
        title={t("button")}
        className="flex size-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
      >
        {/* 文字图标：跟旁边的 lucide size-4 图标视觉重量对齐 */}
        <span className="text-base leading-none">馈</span>
      </button>

      {mounted && createPortal(overlay, document.body)}
    </>
  )
}
