"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslations } from "next-intl"
import { X, Plus, StickyNote, ChevronLeft, ChevronRight } from "lucide-react"
import { listNotes, deleteNote } from "@/lib/api/notes"
import { cn } from "@/lib/utils"
import type { NoteDto } from "@/lib/api/types"

interface NotesPanelProps {
  activeNoteId?: number | null
  onSelect?: (note: NoteDto) => void
  onClose?: () => void
}

export function NotesPanel({ activeNoteId, onSelect, onClose }: NotesPanelProps) {
  const t = useTranslations()
  const [notes, setNotes] = useState<NoteDto[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const pageSize = 20

  const fetchNotes = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const res = await listNotes(p, pageSize)
      setNotes(res.items)
      setTotal(res.total)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotes(page)
  }, [page, fetchNotes])

  const handleDelete = useCallback(async (id: number) => {
    await deleteNote(id)
    fetchNotes(page)
  }, [page, fetchNotes])

  const totalPages = Math.ceil(total / pageSize)

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
        <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
          {total} {t("notes.totalNotes") || "notes"}
        </p>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-[var(--text-tertiary)]">{t("common.loading")}</p>
        </div>
      ) : notes.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4">
          <StickyNote className="size-8 text-[var(--text-tertiary)]" />
          <p className="text-sm text-[var(--text-tertiary)] text-center">
            {t("notes.noNotes") || "No notes yet"}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {notes.map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => onSelect?.(note)}
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
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5 line-clamp-2">
                    {note.content.slice(0, 120)}
                  </p>
                  <p className="text-[10px] text-[var(--text-tertiary)] mt-1.5">
                    {new Date(note.updatedAt).toLocaleDateString()}
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

      {totalPages > 1 && (
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
