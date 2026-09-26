"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { useEditor, useEditorState, EditorContent } from "@tiptap/react"
import type { Editor, JSONContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import type { PaperDetailDto } from "@/lib/api/types"
import { Save, Loader2, AlertTriangle, RotateCw, FileUp } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { useAutosave } from "@/hooks/useAutosave"
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard"
import { ImportMarkdownDialog } from "@/components/papers/ImportMarkdownDialog"
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
  /** 保存正文；版本冲突时应抛出带 code===1008 的错误（后写覆盖被拒） */
  onSave?: (payload: PaperContentPayload) => Promise<void>
  /** 冲突后重新加载最新正文；由调用方重挂编辑器以载入最新内容 */
  onReloadConflict?: () => Promise<void>
  /** 导入 Markdown：把文本转成 HTML 片段返回，编辑器随即 setContent 供用户确认后保存 */
  onImportMarkdown?: (markdown: string) => Promise<string>
}

export function PaperEditor({ paper, content, onSave, onReloadConflict, onImportMarkdown }: PaperEditorProps) {
  const t = useTranslations("papers")
  const tc = useTranslations("common")
  const ti = useTranslations("import")
  const locale = useLocale()
  const [mathDialog, setMathDialog] = useState<MathDialogState | null>(null)
  const [reloading, setReloading] = useState(false)
  const [showImport, setShowImport] = useState(false)

  // 编辑器与自动保存互相依赖：编辑器的 onUpdate 要 markDirty，而 autosave 取内容又要读编辑器。
  // 用 ref 打破这个环——autosave 通过 editorRef 读当前内容，编辑器创建时拿到稳定的 markDirty。
  const editorRef = useRef<Editor | null>(null)

  const autosave = useAutosave<PaperContentPayload>({
    getPayload: () => {
      const ed = editorRef.current
      if (!ed || !onSave) return null
      return { contentJson: ed.getJSON(), contentHtml: ed.getHTML() }
    },
    save: async (payload) => {
      if (!onSave) return
      await onSave(payload)
    },
  })
  const { status, isDirty, markDirty, saveNow } = autosave

  // 有未保存改动时拦截离开：关闭标签页走浏览器原生确认，应用内跳转走自定义确认。
  useUnsavedGuard(isDirty, t("unsavedLeaveConfirm"))

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
      // 内容一变就标脏并安排防抖自动保存；「已保存」标记随之撤下，避免落后于实际内容。
      onUpdate: () => markDirty(),
      immediatelyRender: false,
    },
    [extensions],
  )
  editorRef.current = editor

  const isSaving = status === "saving"

  // 字数统计随内容实时更新；用 useEditorState 订阅，只在纯文本变化时才重算
  const stats = useEditorState({
    editor,
    selector: ({ editor: instance }) =>
      instance ? computeEditorStats(instance.getText()) : { words: 0, characters: 0 },
  })

  const handleReload = async () => {
    if (!onReloadConflict) return
    setReloading(true)
    try {
      await onReloadConflict()
    } finally {
      setReloading(false)
    }
  }

  // 导入成功后把 HTML 灌进编辑器并标脏（setContent 不一定触发 onUpdate），
  // 让用户确认后再走正常保存；抛错则由弹层内部提示，不在这里吞掉。
  const handleImportSubmit = async (markdown: string) => {
    if (!onImportMarkdown) return
    const html = await onImportMarkdown(markdown)
    editor?.commands.setContent(html)
    markDirty()
  }

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg-root)" }}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)] glass-surface">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate">
          {paper.title}
        </h2>
        <div className="flex items-center gap-2">
          {onImportMarkdown && (
            <Button size="sm" variant="secondary" onClick={() => setShowImport(true)}>
              <FileUp className="size-4" />
              <span className="ml-1.5">{ti("importMarkdown")}</span>
            </Button>
          )}
          {onSave && (
          <div className="flex items-center gap-2">
            {status === "saving" && (
              <span className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                <Loader2 className="size-3 animate-spin" />
                {t("saving")}
              </span>
            )}
            {status === "saved" && <span className="text-xs text-green-500">{t("saved")}</span>}
            {status === "failed" && (
              <span className="flex items-center gap-1 text-xs text-red-500">
                {t("saveFailed")}
                <button
                  type="button"
                  onClick={() => saveNow()}
                  className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:opacity-80"
                >
                  <RotateCw className="size-3" />
                  {t("saveRetry")}
                </button>
              </span>
            )}
            {status === "conflict" && (
              <span className="flex items-center gap-1 text-xs text-amber-500">
                <AlertTriangle className="size-3" />
                {t("autosaveConflict")}
                {onReloadConflict && (
                  <button
                    type="button"
                    onClick={handleReload}
                    disabled={reloading}
                    className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:opacity-80 disabled:opacity-50"
                  >
                    {reloading ? <Loader2 className="size-3 animate-spin" /> : <RotateCw className="size-3" />}
                    {t("reloadLatest")}
                  </button>
                )}
              </span>
            )}
            <Button size="sm" onClick={() => saveNow()} disabled={isSaving}>
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

      {onImportMarkdown && (
        <ImportMarkdownDialog
          open={showImport}
          onClose={() => setShowImport(false)}
          onSubmit={handleImportSubmit}
        />
      )}
    </div>
  )
}
