"use client"

import { useCallback, useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { useEditor, useEditorState, EditorContent } from "@tiptap/react"
import type { JSONContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import type { PaperDetailDto } from "@/lib/api/types"
import { Save, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import "katex/dist/katex.min.css"
import { academicExtensions } from "./extensions"
import { AcademicToolbar, type MathDialogState } from "./AcademicToolbar"
import { FormatToolbar } from "./FormatToolbar"
import { TextAlign } from "./text-align"
import { computeEditorStats } from "./editor-stats"

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
  const locale = useLocale()
  const [isSaving, setIsSaving] = useState(false)
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle")
  const [mathDialog, setMathDialog] = useState<MathDialogState | null>(null)

  const footnoteTitle = t("footnoteListTitle")
  const bibliographyTitle = t("bibliographyTitle")
  const crossRefFormula = t("crossRefFormula")
  const crossRefTable = t("crossRefTable")
  const crossRefFigure = t("crossRefFigure")
  const crossRefUnknown = t("crossReferenceUnknown")

  const labels = useMemo(
    () => ({
      formula: crossRefFormula,
      table: crossRefTable,
      figure: crossRefFigure,
      unknown: crossRefUnknown,
    }),
    [crossRefFormula, crossRefTable, crossRefFigure, crossRefUnknown],
  )

  // 公式的点击回调要稳定：它进的是扩展选项，身份一变就得多重建一次编辑器
  const onMathClick = useCallback(
    (kind: MathDialogState["kind"], latex: string, pos: number) => setMathDialog({ kind, latex, pos }),
    [],
  )

  /**
   * 扩展列表在编辑器创建时就固化了，每轮渲染重建一份没有意义、也没法在运行时替换，
   * 所以按真正会进扩展选项的这几处文案做 memo。
   */
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: t("editorPlaceholder"),
      }),
      // 对齐属性挂在标题/段落上，导出的 HTML 用行内 style 承载，脱离编辑器也能还原
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      ...academicExtensions({
        locale,
        footnoteTitle,
        bibliographyTitle,
        crossReferenceLabels: labels,
        onMathClick,
      }),
    ],
    // t 每次渲染都是新对象，依赖它反而会让 memo 失效；真正相关的只有下面这几项
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, footnoteTitle, bibliographyTitle, labels, onMathClick],
  )

  const editor = useEditor(
    {
      extensions,
      content: content ?? "",
      editorProps: {
        attributes: {
          class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none",
        },
      },
      // 改动后立刻撤掉「已保存」，避免提示落后于实际内容。
      onUpdate: () => setStatus("idle"),
      immediatelyRender: false,
    },
    [extensions],
  )

  // 字数统计随内容实时更新；用 useEditorState 订阅，只在纯文本变化时才重算
  const stats = useEditorState({
    editor,
    selector: ({ editor: instance }) =>
      instance ? computeEditorStats(instance.getText()) : { words: 0, characters: 0 },
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

      <FormatToolbar editor={editor} />

      <AcademicToolbar
        editor={editor}
        labels={labels}
        mathDialog={mathDialog}
        onOpenMathDialog={setMathDialog}
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <EditorContent editor={editor} />
      </div>

      <div className="flex items-center justify-end gap-3 px-8 py-1.5 border-t border-[var(--border-subtle)] text-xs text-[var(--text-tertiary)]">
        <span>{t("editorCharCount", { count: stats?.characters ?? 0 })}</span>
        <span>{t("editorWordCount", { count: stats?.words ?? 0 })}</span>
      </div>
    </div>
  )
}
