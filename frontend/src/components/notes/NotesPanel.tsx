"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslations } from "next-intl"
import { X, Plus, StickyNote, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { listNotes, deleteNote } from "@/lib/api/notes"
import { cn } from "@/lib/utils"
import { useReaderStore } from "@/stores/reader-store"
import { usePaperStore } from "@/stores/paper-store"
import type { NoteDto } from "@/lib/api/types"

interface NotesPanelProps {
  activeNoteId?: number | null
  onSelect?: (note: NoteDto) => void
  onClose?: () => void
  onNavigateToPaper?: (paperId: number) => void
}

type NotesTab = "all" | "current"

export function NotesPanel({ activeNoteId, onSelect, onClose, onNavigateToPaper }: NotesPanelProps) {
  const t = useTranslations()
  const [tab, setTab] = useState<NotesTab>("all")

  // Global notes state (paginated)
  const [allNotes, setAllNotes] = useState<NoteDto[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loadingAll, setLoadingAll] = useState(true)
  const pageSize = 20

  // Current paper notes from reader store
  const currentPaperNotes = useReaderStore((s) => s.notes)
  const loadingCurrent = useReaderStore((s) => s.loadingNotes)
  const loadNotes = useReaderStore((s) => s.loadNotes)
  const setNavigationTarget = useReaderStore((s) => s.setNavigationTarget)
  const currentPaper = usePaperStore((s) => s.currentPaper)

  const fetchAllNotes = useCallback(async (p: number) => {
    setLoadingAll(true)
    try {
      const res = await listNotes(p, pageSize)
      setAllNotes(res.items)
      setTotal(res.total)
    } catch {
      // ignore
    } finally {
      setLoadingAll(false)
    }
  }, [])

  useEffect(() => {
    fetchAllNotes(page)
  }, [page, fetchAllNotes])

  useEffect(() => {
    if (currentPaper?.id) loadNotes(currentPaper.id)
  }, [currentPaper?.id, loadNotes])

  const handleDelete = useCallback(async (id: number) => {
    await deleteNote(id)
    fetchAllNotes(page)
  }, [page, fetchAllNotes])

  type DisplayNote = { id: number; paperId: number; pageNumber?: number; title?: string; content: string; updatedAt?: string; createdAt: string }

  const handleCardClick = useCallback((note: DisplayNote) => {
    const pos = (note as unknown as Record<string, unknown>).position as Record<string, number> | undefined
    setNavigationTarget({
      pageNumber: note.pageNumber || 1,
      position: pos ? { x: Number(pos.x ?? 0), y: Number(pos.y ?? 0), width: Number(pos.width ?? 0), height: Number(pos.height ?? 0) } : undefined,
      timestamp: Date.now(),
    })
    if (note.paperId !== currentPaper?.id) {
      onNavigateToPaper?.(note.paperId)
    }
    onSelect?.(note as NoteDto)
  }, [currentPaper?.id, onNavigateToPaper, onSelect, setNavigationTarget])

  const handleCurrentNoteClick = useCallback((note: DisplayNote) => {
    const storeNotes = useReaderStore.getState().notes
    const fullNote = storeNotes.find((n) => n.id === note.id)
    setNavigationTarget({
      pageNumber: fullNote?.pageNumber || note.pageNumber || 1,
      position: fullNote?.position,
      timestamp: Date.now(),
    })
    onSelect?.(note as NoteDto)
  }, [onSelect, setNavigationTarget])

  const totalPages = Math.ceil(total / pageSize)
  const loading = tab === "all" ? loadingAll : loadingCurrent
  const displayNotes = tab === "all" ? allNotes : currentPaperNotes

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            {t("nav.notes")}
          </h2>
          <div className="flex items-center gap-0.5">
            <button
              title="Create note"
              className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            {onClose && (
              <button onClick={onClose}
                className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex rounded-lg bg-[var(--surface-2)] p-0.5 gap-0.5 mt-2">
          {(["all", "current"] as NotesTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 py-1.5 text-xs rounded-md transition-all font-medium",
                tab === t
                  ? "bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
              )}
            >
              {t === "current" ? "当前论文笔记" : "全部笔记"}
            </button>
          ))}
        </div>

        {tab === "all" && (
          <p className="text-[11px] text-[var(--text-tertiary)] mt-2">
            {total} {t("notes.totalNotes") || "notes"}
          </p>
        )}
      </div>

      {loading && displayNotes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="size-5 animate-spin text-[var(--text-tertiary)]" />
        </div>
      ) : displayNotes.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4">
          <StickyNote className="size-8 text-[var(--text-tertiary)]" />
          <p className="text-sm text-[var(--text-tertiary)] text-center">
            {t("notes.noNotes") || "No notes yet"}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {(displayNotes as DisplayNote[]).map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => tab === "all" ? handleCardClick(note) : handleCurrentNoteClick(note)}
              className={cn(
                "group w-full text-left p-3 rounded-xl transition-all hover:bg-[var(--surface-2)]",
                activeNoteId === note.id && "bg-[var(--surface-2)] ring-1 ring-[var(--accent)]",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {note.title || "Untitled Note"}
                  </p>
                  {tab === "all" && note.pageNumber != null && (
                    <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                      Paper #{note.paperId} · 第{note.pageNumber}页
                    </p>
                  )}
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5 line-clamp-2">
                    {note.content.slice(0, 120)}
                  </p>
                  <p className="text-[10px] text-[var(--text-tertiary)] mt-1.5">
                    {new Date(note.updatedAt || note.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(note.id) }}
                  className="shrink-0 p-1 rounded-md text-[var(--text-tertiary)] hover:text-red-500 hover:bg-[var(--bg-hover)] transition-all opacity-0 group-hover:opacity-100"
                >
                  <X className="size-3" />
                </button>
              </div>
            </button>
          ))}
        </div>
      )}

      {tab === "all" && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--border-subtle)]">
          <button
            disabled={page <= 0}
            onClick={() => setPage(page - 1)}
            className="p-1 rounded-md text-[var(--text-tertiary)] disabled:opacity-30 hover:text-[var(--text-primary)] transition-all"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-xs text-[var(--text-tertiary)]">
            {page + 1}/{totalPages}
          </span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage(page + 1)}
            className="p-1 rounded-md text-[var(--text-tertiary)] disabled:opacity-30 hover:text-[var(--text-primary)] transition-all"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}
