"use client"

import { useTranslations } from "next-intl"
import { FileText, Trash2, Tag } from "lucide-react"
import { Button } from "@/components/ui/Button"
import type { NoteDto } from "@/lib/api/types"
import { cn } from "@/lib/utils"

interface NoteListProps {
  notes: NoteDto[]
  activeNoteId?: number | null
  onSelect: (note: NoteDto) => void
  onDelete: (id: number) => void
}

export function NoteList({ notes, activeNoteId, onSelect, onDelete }: NoteListProps) {
  const t = useTranslations("notes")

  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <FileText className="size-8 text-[var(--text-tertiary)] mb-2" />
        <p className="text-sm text-[var(--text-tertiary)]">{t("noNotes")}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      {notes.map((note) => (
        <button
          key={note.id}
          type="button"
          onClick={() => onSelect(note)}
          className={cn(
            "text-left p-3 rounded-xl transition-all hover:bg-[var(--surface-2)]",
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
              {note.tags && note.tags.length > 0 && (
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  {note.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[var(--surface-1)] text-[10px] text-[var(--text-tertiary)]"
                    >
                      <Tag className="size-2.5" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 opacity-0 group-hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); onDelete(note.id) }}
            >
              <Trash2 className="size-3 text-[var(--text-tertiary)]" />
            </Button>
          </div>
        </button>
      ))}
    </div>
  )
}
