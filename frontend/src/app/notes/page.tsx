"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslations } from "next-intl"
import { Plus, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { NoteList } from "@/components/notes/NoteList"
import { NoteEditor } from "@/components/notes/NoteEditor"
import { listNotes, createNote, updateNote, deleteNote } from "@/lib/api/notes"
import type { NoteDto, CreateNoteRequest } from "@/lib/api/types"

export default function NotesPage() {
  const t = useTranslations("notes")
  const c = useTranslations("common")
  const [notes, setNotes] = useState<NoteDto[]>([])
  const [activeNote, setActiveNote] = useState<NoteDto | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const loadNotes = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await listNotes(1, 100)
      setNotes(res.items)
    } catch {
      // silent
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { loadNotes() }, [loadNotes])

  const handleSelect = useCallback((note: NoteDto) => {
    setActiveNote(note)
    setShowEditor(true)
  }, [])

  const handleNew = useCallback(() => {
    setActiveNote(null)
    setShowEditor(true)
  }, [])

  const handleSave = useCallback(async (data: CreateNoteRequest) => {
    if (activeNote) {
      const updated = await updateNote(activeNote.id, data)
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
      setActiveNote(updated)
    } else {
      const created = await createNote(data)
      setNotes((prev) => [created, ...prev])
      setActiveNote(created)
    }
  }, [activeNote])

  const handleDelete = useCallback(async (id: number) => {
    if (!confirm("Delete this note?")) return
    await deleteNote(id)
    setNotes((prev) => prev.filter((n) => n.id !== id))
    if (activeNote?.id === id) {
      setActiveNote(null)
      setShowEditor(false)
    }
  }, [activeNote])

  const handleCancel = useCallback(() => {
    setShowEditor(false)
    setActiveNote(null)
  }, [])

  return (
    <div className="min-h-screen bg-[var(--surface-1)] flex">
      {/* Sidebar */}
      <div className="w-72 border-r border-[var(--border-color)] flex flex-col bg-[var(--surface-0)]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <Link href="/" className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
              <ArrowLeft className="size-4" />
            </Link>
            <h1 className="text-sm font-semibold text-[var(--text-primary)]">{t("newNote")}</h1>
          </div>
          <Button size="sm" onClick={handleNew}>
            <Plus className="size-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <p className="text-sm text-[var(--text-tertiary)] text-center py-8">{c("loading")}</p>
          ) : (
            <NoteList
              notes={notes}
              activeNoteId={activeNote?.id}
              onSelect={handleSelect}
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1">
        {showEditor ? (
          <NoteEditor
            note={activeNote}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-[var(--text-tertiary)]">
              {notes.length === 0 ? t("noNotes") : "Select a note or create a new one"}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
