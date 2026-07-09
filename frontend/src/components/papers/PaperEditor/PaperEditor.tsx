"use client"

import { useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import type { PaperDetailDto } from "@/lib/api/types"
import { Save, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/Button"

export interface PaperEditorProps {
  paper: PaperDetailDto
  onSave?: (content: string) => Promise<void>
}

export function PaperEditor({ paper, onSave }: PaperEditorProps) {
  const [isSaving, setIsSaving] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "Start writing your paper...",
      }),
    ],
    content: paper.abstractText || "",
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none",
      },
    },
    immediatelyRender: false,
  })

  const handleSave = async () => {
    if (!editor || !onSave) return
    setIsSaving(true)
    try {
      const html = editor.getHTML()
      await onSave(html)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg-root)" }}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)] glass-surface">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate">
          {paper.title}
        </h2>
        {onSave && (
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            <span className="ml-1.5">Save</span>
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
