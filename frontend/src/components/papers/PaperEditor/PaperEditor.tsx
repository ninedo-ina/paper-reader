"use client"

import { useCallback, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { useEditor, EditorContent, type JSONContent } from "@tiptap/react"
import type { PaperDetailDto } from "@/lib/api/types"
import { Save, Loader2, Check, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { EditorToolbar } from "./Toolbar"
import { createPaperEditorExtensions, computeEditorStats } from "./editor-config"

/** Body content handed back to the caller on save (matches the W1 content API). */
export interface PaperContentPayload {
  contentJson: JSONContent
  contentHtml: string
}

export interface PaperEditorProps {
  paper: PaperDetailDto
  /**
   * The persisted document body (W1). `null` means "never saved yet".
   * This is the real content — it never falls back to `paper.abstractText`.
   */
  content: JSONContent | null
  onSave?: (payload: PaperContentPayload) => Promise<void>
}

type SaveState = "idle" | "saving" | "saved" | "failed"

export function PaperEditor({ paper, content, onSave }: PaperEditorProps) {
  const t = useTranslations("papers")
  const ts = useTranslations("settings")
  const tc = useTranslations("common")
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [stats, setStats] = useState<{ words: number; characters: number }>({ words: 0, characters: 0 })

  const extensions = useMemo(() => createPaperEditorExtensions(t("editorPlaceholder")), [t])

  const editor = useEditor({
    extensions,
    content: content ?? "",
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-full",
      },
    },
    immediatelyRender: false,
    onCreate: ({ editor }) => setStats(computeEditorStats(editor.getText())),
    onUpdate: ({ editor }) => {
      setStats(computeEditorStats(editor.getText()))
      // A fresh edit invalidates the "saved" badge.
      setSaveState((prev) => (prev === "saved" ? "idle" : prev))
    },
  })

  const handleSave = useCallback(async () => {
    if (!editor || !onSave) return
    setSaveState("saving")
    try {
      await onSave({ contentJson: editor.getJSON(), contentHtml: editor.getHTML() })
      setSaveState("saved")
    } catch {
      setSaveState("failed")
    }
  }, [editor, onSave])

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg-root)" }}>
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-[var(--border-subtle)] glass-surface">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate">{paper.title}</h2>
        {onSave && (
          <div className="flex items-center gap-2 shrink-0">
            <SaveStatus state={saveState} savedLabel={ts("saved")} failedLabel={ts("saveFailed")} />
            <Button size="sm" onClick={handleSave} disabled={saveState === "saving"}>
              {saveState === "saving" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              <span className="ml-1.5">{tc("save")}</span>
            </Button>
          </div>
        )}
      </div>

      {onSave && <EditorToolbar editor={editor} />}

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <EditorContent editor={editor} />
      </div>

      <div className="flex items-center justify-end gap-4 px-4 py-1.5 border-t border-[var(--border-subtle)] text-xs text-[var(--text-tertiary)]">
        <span>{stats.words} words</span>
        <span>{stats.characters} chars</span>
      </div>
    </div>
  )
}

function SaveStatus({ state, savedLabel, failedLabel }: { state: SaveState; savedLabel: string; failedLabel: string }) {
  if (state === "saved") {
    return (
      <span className="flex items-center gap-1 text-xs text-[var(--success,#16a34a)]">
        <Check className="size-3.5" /> {savedLabel}
      </span>
    )
  }
  if (state === "failed") {
    return (
      <span className="flex items-center gap-1 text-xs text-[var(--danger,#dc2626)]">
        <TriangleAlert className="size-3.5" /> {failedLabel}
      </span>
    )
  }
  return null
}
