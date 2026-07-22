"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslations } from "next-intl"
import { X, Highlighter, Loader2 } from "lucide-react"
import { listAllAnnotations, deleteAnnotation } from "@/lib/api/annotations"
import { cn } from "@/lib/utils"
import { useReaderStore } from "@/stores/reader-store"
import { usePaperStore } from "@/stores/paper-store"
import type { AnnotationDto } from "@/lib/api/types"

interface AnnotationsPanelProps {
  activeAnnotationId?: number | null
  onSelect?: (ann: AnnotationDto) => void
  onClose?: () => void
  onNavigateToPaper?: (paperId: number) => void
}

type AnnotationsTab = "all" | "current"

export function AnnotationsPanel({ activeAnnotationId, onSelect, onClose, onNavigateToPaper }: AnnotationsPanelProps) {
  const t = useTranslations()
  const [tab, setTab] = useState<AnnotationsTab>("all")

  const [allAnnotations, setAllAnnotations] = useState<AnnotationDto[]>([])
  const [loadingAll, setLoadingAll] = useState(true)

  const currentAnnotations = useReaderStore((s) => s.annotations)
  const loadingCurrent = useReaderStore((s) => s.loadingAnnotations)
  const loadAnnotations = useReaderStore((s) => s.loadAnnotations)
  const setNavigationTarget = useReaderStore((s) => s.setNavigationTarget)
  const currentPaper = usePaperStore((s) => s.currentPaper)

  const fetchAll = useCallback(async () => {
    setLoadingAll(true)
    try {
      const res = await listAllAnnotations(0, 200)
      setAllAnnotations(res.items || [])
    } catch {
      // ignore
    } finally {
      setLoadingAll(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useEffect(() => {
    if (currentPaper?.id) loadAnnotations(currentPaper.id)
  }, [currentPaper?.id, loadAnnotations])

  const handleDelete = useCallback(async (id: number) => {
    await deleteAnnotation(id)
    fetchAll()
  }, [fetchAll])

  const handleCardClick = useCallback((ann: { id: number; paperId: number; pageNumber: number; position: Record<string, unknown> }) => {
    const pos = ann.position as unknown as Record<string, number> | undefined
    setNavigationTarget({
      pageNumber: ann.pageNumber || 1,
      position: pos ? { x: Number(pos.x ?? 0), y: Number(pos.y ?? 0), width: Number(pos.width ?? 0), height: Number(pos.height ?? 0) } : undefined,
      timestamp: Date.now(),
    })
    if (ann.paperId !== currentPaper?.id) {
      onNavigateToPaper?.(ann.paperId)
    }
    onSelect?.(ann as AnnotationDto)
  }, [currentPaper?.id, onNavigateToPaper, onSelect, setNavigationTarget])

  const handleCurrentClick = useCallback((ann: { id: number; pageNumber: number }) => {
    const storeAnns = useReaderStore.getState().annotations
    const full = storeAnns.find((a) => a.id === ann.id)
    setNavigationTarget({
      pageNumber: full?.pageNumber || ann.pageNumber || 1,
      position: full?.position,
      timestamp: Date.now(),
    })
    onSelect?.(ann as AnnotationDto)
  }, [onSelect, setNavigationTarget])

  const loading = tab === "all" ? loadingAll : loadingCurrent
  const displayAnns = tab === "all" ? allAnnotations : currentAnnotations

  type DisplayAnnotation = { id: number; paperId: number; pageNumber: number; quotedText?: string; comment?: string; position: Record<string, unknown>; createdAt: string }
  const renderCard = (ann: DisplayAnnotation) => {
    const onClick = () => tab === "all" ? handleCardClick(ann) : handleCurrentClick(ann)
    return (
      <button
        key={ann.id}
        type="button"
        onClick={onClick}
        className={cn(
          "group w-full text-left p-3 rounded-xl transition-all hover:bg-[var(--surface-2)]",
          activeAnnotationId === ann.id && "bg-[var(--surface-2)] ring-1 ring-[var(--accent)]",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {ann.quotedText && (
              <p className="text-xs text-[var(--text-secondary)] line-clamp-2 italic border-l-2 border-[var(--accent)]/40 pl-2 mb-1">
                &ldquo;{ann.quotedText.slice(0, 150)}&rdquo;
              </p>
            )}
            {ann.comment && (
              <p className="text-sm text-[var(--text-primary)] line-clamp-2">
                {ann.comment.slice(0, 120)}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1">
              {tab === "all" && (
                <span className="text-[10px] text-[var(--text-tertiary)]">
                  Paper #{ann.paperId} · 第{ann.pageNumber}页
                </span>
              )}
              {tab === "current" && ann.pageNumber != null && (
                <span className="text-[10px] text-[var(--text-tertiary)]">
                  第{ann.pageNumber}页
                </span>
              )}
              <span className="text-[10px] text-[var(--text-tertiary)]">
                {new Date(ann.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(ann.id) }}
            className="shrink-0 p-1 rounded-md text-[var(--text-tertiary)] hover:text-red-500 hover:bg-[var(--bg-hover)] transition-all opacity-0 group-hover:opacity-100"
          >
            <X className="size-3" />
          </button>
        </div>
      </button>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            {t("nav.annotations") || "Annotations"}
          </h2>
          {onClose && (
            <button onClick={onClose}
              className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex rounded-lg bg-[var(--surface-2)] p-0.5 gap-0.5 mt-2">
          {(["all", "current"] as AnnotationsTab[]).map((tt) => (
            <button
              key={tt}
              onClick={() => setTab(tt)}
              className={cn(
                "flex-1 py-1.5 text-xs rounded-md transition-all font-medium",
                tab === tt
                  ? "bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
              )}
            >
              {tt === "current" ? "当前论文批注" : "全部批注"}
            </button>
          ))}
        </div>

        {tab === "all" && (
          <p className="text-[11px] text-[var(--text-tertiary)] mt-2">
            {allAnnotations.length} annotations
          </p>
        )}
      </div>

      {loading && displayAnns.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="size-5 animate-spin text-[var(--text-tertiary)]" />
        </div>
      ) : displayAnns.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4">
          <Highlighter className="size-8 text-[var(--text-tertiary)]" />
          <p className="text-sm text-[var(--text-tertiary)] text-center">
            No annotations yet
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {(displayAnns as DisplayAnnotation[]).map(renderCard)}
        </div>
      )}
    </div>
  )
}
