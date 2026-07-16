"use client"

import { useState, useRef, type ChangeEvent } from "react"
import { X, ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface AnnotationDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: { markdown: string; images: string[]; title?: string }) => void
  mode: "annotation" | "note"
  selectedText?: string
  initialMarkdown?: string
  initialImages?: string[]
  initialTitle?: string
}

const MAX_ANNOTATION_CHARS = 400
const MAX_ANNOTATION_IMAGES = 3

export function AnnotationDialog({ open, onClose, onSubmit, mode, selectedText, initialMarkdown, initialImages, initialTitle }: AnnotationDialogProps) {
  const [markdown, setMarkdown] = useState(initialMarkdown || "")
  const [images, setImages] = useState<string[]>(initialImages || [])
  const [title, setTitle] = useState(initialTitle || "")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isEditing = !!(initialMarkdown || initialImages?.length || initialTitle)

  if (!open) return null

  const charCount = markdown.length
  const charLimit = mode === "annotation" ? MAX_ANNOTATION_CHARS : Infinity
  const imageLimit = mode === "annotation" ? MAX_ANNOTATION_IMAGES : Infinity
  const isOverLimit = charCount > charLimit

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const remaining = imageLimit - images.length
    if (remaining <= 0) return

    Array.from(files).slice(0, remaining).forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        setImages((prev) => [...prev, reader.result as string])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = () => {
    onSubmit({ markdown: markdown.trim(), images, title: title.trim() || undefined })
    setMarkdown("")
    setImages([])
    setTitle("")
    onClose()
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    if (mode === "annotation") return
    const items = e.clipboardData.items
    for (const item of items) {
      if (item.type.startsWith("image/") && images.length < imageLimit) {
        const file = item.getAsFile()
        if (file) {
          const reader = new FileReader()
          reader.onload = () => setImages((prev) => [...prev, reader.result as string])
          reader.readAsDataURL(file)
        }
      }
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-surface-strong rounded-xl border border-[var(--border-color)] shadow-2xl w-[480px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {mode === "annotation" ? (isEditing ? "编辑批注" : "创建批注") : (isEditing ? "编辑笔记" : "创建笔记")}
          </h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-[var(--bg-hover)] transition-colors">
            <X className="size-4 text-[var(--text-tertiary)]" />
          </button>
        </div>

        {/* Selected text preview */}
        {selectedText && (
          <div className="px-4 py-2 bg-[var(--bg-hover)] border-b border-[var(--border-subtle)]">
            <p className="text-xs text-[var(--text-tertiary)] mb-1">引用原文</p>
            <p className="text-sm text-[var(--text-secondary)] line-clamp-3">{selectedText}</p>
          </div>
        )}

        {/* Title input (notes only) */}
        {mode === "note" && (
          <div className="px-4 pt-4">
            <input
              type="text"
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-0)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="笔记标题（可选）"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        )}

        {/* Markdown input */}
        <div className="flex-1 p-4">
          <textarea
            className="w-full min-h-[120px] resize-none rounded-lg border border-[var(--border-color)] bg-[var(--surface-0)] p-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            placeholder={mode === "annotation" ? "输入批注内容（支持Markdown格式）..." : "输入笔记内容（支持Markdown格式）..."}
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            onPaste={handlePaste}
            autoFocus
          />
          {mode === "annotation" && (
            <p className={cn("text-xs mt-1 text-right", isOverLimit ? "text-red-500" : "text-[var(--text-tertiary)]")}>
              {charCount}/{charLimit}
            </p>
          )}
        </div>

        {/* Image area — only for notes */}
        {mode === "note" && images.length > 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-2">
            {images.map((src, idx) => (
              <div key={idx} className="relative group">
                <img src={src} alt="" className="size-16 rounded-lg object-cover border border-[var(--border-subtle)]" />
                <button
                  onClick={() => removeImage(idx)}
                  className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="size-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            {mode === "note" && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={images.length >= imageLimit}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-40"
                >
                  <ImageIcon className="size-3.5" />
                  插入图片
                  {imageLimit < Infinity && ` (${images.length}/${imageLimit})`}
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={!markdown.trim() || isOverLimit}
              className="px-4 py-1.5 text-sm bg-[var(--accent)] text-[var(--surface-1)] rounded-md hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-40"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
