"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Highlighter, Underline, Strikethrough, MessageSquare, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AnnotationType, AnnotationDto } from "@/lib/api/types"

interface AnnotationLayerProps {
  pageNumber: number
  annotations: AnnotationDto[]
  onAdd: (type: AnnotationType, text: string, position: Record<string, unknown>) => Promise<void>
  onDelete: (id: number) => void
}

const COLORS = ["#FFD700", "#FF6B6B", "#4ECDC4", "#A78BFA", "#60A5FA", "#FBBF24", "transparent"]

export function AnnotationLayer({ pageNumber, annotations, onAdd, onDelete }: AnnotationLayerProps) {
  const t = useTranslations("annotation")
  const [selectedText, setSelectedText] = useState("")
  const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number } | null>(null)
  const [selectedColor, setSelectedColor] = useState(COLORS[0])
  const [isAdding, setIsAdding] = useState(false)
  const layerRef = useRef<HTMLDivElement>(null)

  const pageAnnotations = annotations.filter((a) => a.pageNumber === pageNumber)

  useEffect(() => {
    const handleSelection = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setSelectedText("")
        setToolbarPos(null)
        return
      }

      const text = sel.toString().trim()
      if (!text) return

      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      if (!layerRef.current?.contains(range.commonAncestorContainer)) return

      setSelectedText(text)
      setToolbarPos({
        x: rect.left + rect.width / 2,
        y: rect.top - 40,
      })
    }

    document.addEventListener("selectionchange", handleSelection)
    return () => document.removeEventListener("selectionchange", handleSelection)
  }, [])

  const handleAnnotate = useCallback(
    async (type: AnnotationType) => {
      if (!selectedText || isAdding) return
      setIsAdding(true)
      try {
        const color = type === "HIGHLIGHT" && selectedColor !== "transparent" ? selectedColor : undefined
        const position = {
          text: selectedText,
          boundingRect: toolbarPos ? { x: toolbarPos.x, y: toolbarPos.y + 40 } : undefined,
          color,
        }
        await onAdd(type, selectedText, position)
        setSelectedText("")
        setToolbarPos(null)
      } finally {
        setIsAdding(false)
      }
    },
    [selectedText, selectedColor, toolbarPos, isAdding, onAdd],
  )

  return (
    <div ref={layerRef} className="relative">
      {/* Selection toolbar */}
      {toolbarPos && selectedText && (
        <div
          className="fixed z-50 glass-surface-strong rounded-xl border border-[var(--border-color)] shadow-2xl px-2 py-1.5 flex items-center gap-1 animate-in fade-in zoom-in-95"
          style={{ left: toolbarPos.x, top: toolbarPos.y, transform: "translate(-50%, -100%)" }}
        >
          <button
            type="button"
            onClick={() => handleAnnotate("HIGHLIGHT")}
            disabled={isAdding}
            className={cn("p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors", isAdding && "opacity-50")}
            title={t("highlight")}
          >
            <Highlighter className="size-4 text-[var(--text-primary)]" />
          </button>
          <button
            type="button"
            onClick={() => handleAnnotate("UNDERLINE")}
            disabled={isAdding}
            className={cn("p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors", isAdding && "opacity-50")}
            title={t("underline")}
          >
            <Underline className="size-4 text-[var(--text-primary)]" />
          </button>
          <button
            type="button"
            onClick={() => handleAnnotate("STRIKETHROUGH")}
            disabled={isAdding}
            className={cn("p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors", isAdding && "opacity-50")}
            title={t("strikethrough")}
          >
            <Strikethrough className="size-4 text-[var(--text-primary)]" />
          </button>
          <button
            type="button"
            onClick={() => handleAnnotate("NOTE")}
            disabled={isAdding}
            className={cn("p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors", isAdding && "opacity-50")}
            title={t("note")}
          >
            <MessageSquare className="size-4 text-[var(--text-primary)]" />
          </button>
          <div className="w-px h-5 bg-[var(--border-color)] mx-0.5" />
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setSelectedColor(c)}
              title={c === "transparent" ? t("color") : c}
              className={cn(
                "size-5 rounded-full border-2 transition-all",
                c === "transparent" && "border-dashed",
                selectedColor === c
                  ? "border-[var(--accent)] scale-110"
                  : "border-[var(--border-color)] hover:scale-105",
              )}
              style={c !== "transparent" ? { backgroundColor: c } : undefined}
            />
          ))}
          <div className="w-px h-5 bg-[var(--border-color)] mx-0.5" />
          <button
            type="button"
            onClick={() => { setSelectedText(""); setToolbarPos(null) }}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
            title={t("delete")}
          >
            <X className="size-4 text-[var(--text-tertiary)]" />
          </button>
        </div>
      )}

      {/* Existing annotation chips */}
      {pageAnnotations.map((ann) => (
        <AnnotationChip key={ann.id} annotation={ann} onDelete={() => onDelete(ann.id)} />
      ))}
    </div>
  )
}

function AnnotationChip({ annotation, onDelete }: { annotation: AnnotationDto; onDelete: () => void }) {
  const [showActions, setShowActions] = useState(false)

  return (
    <div
      className="relative inline-flex items-center gap-1 group"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <span
        className={cn("px-1 py-0.5 rounded text-sm", annotation.type === "HIGHLIGHT" && "bg-yellow-200 dark:bg-yellow-800")}
        style={
          annotation.type === "HIGHLIGHT" && annotation.color
            ? { backgroundColor: annotation.color + "40" }
            : undefined
        }
      >
        {annotation.text || annotation.comment || annotation.type}
        {annotation.type === "UNDERLINE" && <span className="border-b-2 border-[var(--text-primary)]">{annotation.text}</span>}
        {annotation.type === "STRIKETHROUGH" && <span className="line-through text-[var(--text-tertiary)]">{annotation.text}</span>}
      </span>
      {showActions && (
        <button
          type="button"
          onClick={onDelete}
          className="absolute -top-1 -right-1 size-4 rounded-full bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="size-2.5 text-white" />
        </button>
      )}
    </div>
  )
}
