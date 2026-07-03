"use client"

import { useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { Save, Eye, Edit3, X, Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import type { NoteDto, CreateNoteRequest } from "@/lib/api/types"

interface NoteEditorProps {
  paperId?: number
  note?: NoteDto | null
  onSave: (data: CreateNoteRequest) => Promise<void>
  onCancel: () => void
}

export function NoteEditor({ paperId, note, onSave, onCancel }: NoteEditorProps) {
  const t = useTranslations("notes")
  const [title, setTitle] = useState(note?.title ?? "")
  const [content, setContent] = useState(note?.content ?? "")
  const [tagsInput, setTagsInput] = useState(note?.tags?.join(", ") ?? "")
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = useCallback(async () => {
    if (!paperId && !note) return
    if (!content.trim()) return
    setSaving(true)
    setError(null)
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
      await onSave({
        paperId: paperId ?? note!.paperId,
        title: title.trim() || undefined,
        content: content.trim(),
        tags: tags.length > 0 ? tags : undefined,
      })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }, [paperId, note, title, content, tagsInput, onSave])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-color)]">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title..."
          className="flex-1 bg-transparent text-sm font-medium text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
        />
        <Button variant="ghost" size="sm" onClick={() => setPreview(!preview)}>
          {preview ? <Edit3 className="size-4" /> : <Eye className="size-4" />}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="size-4" />
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving || !content.trim()}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {preview ? (
          <div className="prose prose-sm dark:prose-invert max-w-none text-[var(--text-primary)]">
            {content.split("\n").map((line, i) => (
              <p key={i}>{line || " "}</p>
            ))}
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your note in markdown..."
            className="w-full h-full min-h-[200px] bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none"
          />
        )}
      </div>

      <div className="px-3 py-2 border-t border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <Plus className="size-3 text-[var(--text-tertiary)]" />
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder={t("tags") + " (comma separated)"}
            className="flex-1 bg-transparent text-xs text-[var(--text-secondary)] placeholder:text-[var(--text-tertiary)] outline-none"
          />
        </div>
      </div>

      {error && <p className="px-3 py-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
