"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useEditor, EditorContent } from "@tiptap/react"
import type { JSONContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import type { PaperDetailDto } from "@/lib/api/types"
import { Save, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/Button"

export interface PaperContentPayload {
  /** 权威内容：编辑器节点树 */
  contentJson: JSONContent
  /** 派生内容：由 contentJson 渲染出的 HTML */
  contentHtml: string
}

export interface PaperEditorProps {
  paper: PaperDetailDto
  /** 已落库的正文；调用方保证加载完成后才挂载本组件 */
  content: JSONContent | null
  onSave?: (payload: PaperContentPayload) => Promise<void>
}

export function PaperEditor({ paper, content, onSave }: PaperEditorProps) {
  const t = useTranslations("papers")
  const tc = useTranslations("common")
  const [isSaving, setIsSaving] = useState(false)
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle")

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: t("editorPlaceholder"),
      }),
    ],
    content: content ?? "",
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none",
      },
    },
    // 改动后立刻撤掉「已保存」，避免提示落后于实际内容。
    onUpdate: () => setStatus("idle"),
    immediatelyRender: false,
  })

  const handleSave = async () => {
    if (!editor || !onSave) return
    setIsSaving(true)
    setStatus("idle")
    try {
      await onSave({ contentJson: editor.getJSON(), contentHtml: editor.getHTML() })
      setStatus("saved")
    } catch {
      setStatus("failed")
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
          <div className="flex items-center gap-2">
            {status === "saved" && <span className="text-xs text-green-500">{t("saved")}</span>}
            {status === "failed" && <span className="text-xs text-red-500">{t("saveFailed")}</span>}
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              <span className="ml-1.5">{tc("save")}</span>
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
