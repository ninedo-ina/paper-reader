"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { useEditor, useEditorState, EditorContent } from "@tiptap/react"
import type { Editor, Extensions, JSONContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Collaboration from "@tiptap/extension-collaboration"
import CollaborationCaret from "@tiptap/extension-collaboration-caret"
import type { Doc } from "yjs"
import type { StompYjsProvider } from "@/lib/collab/stompYjsProvider"
import type { PaperContentDto, PaperDetailDto } from "@/lib/api/types"
import { Save, Loader2, AlertTriangle, RotateCw, FileUp, History } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { CONTENT_TOO_LARGE_CODE, useAutosave } from "@/hooks/useAutosave"
import { useContentLimits } from "@/hooks/useContentLimits"
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard"
import { ImportMarkdownDialog } from "@/components/papers/ImportMarkdownDialog"
import { checkContentSize } from "@/lib/content-limits"
import { formatFileSize } from "@/lib/utils"
import "katex/dist/katex.min.css"
import { academicExtensions } from "./extensions"
import { AcademicToolbar, type MathDialogState } from "./AcademicToolbar"
import { AiWritingPanel } from "./AiWritingPanel"
import { AiWritingToolbar, type AiWritingRequest } from "./AiWritingToolbar"
import { FormatToolbar } from "./FormatToolbar"
import { TextAlign } from "./text-align"
import { computeEditorStats } from "./editor-stats"
import { ContentHistoryDialog } from "./ContentHistoryDialog"

export interface PaperContentPayload {
  /** 权威内容：编辑器节点树 */
  contentJson: JSONContent
  /** 派生内容：由 contentJson 渲染出的 HTML */
  contentHtml: string
}

/**
 * 协作模式配置（W7）。传入即启用 Yjs 实时协作：编辑器不再吃 content prop，
 * 正文由共享的 Y.Doc 承载；StarterKit 的撤销/重做交给 Yjs，避免与 CRDT 打架。
 */
export interface CollabConfig {
  doc: Doc
  provider: StompYjsProvider
  user: { name: string; color: string }
  /** 当前用户是否可写（作者或 EDITOR）；VIEWER/导师只读，仅能在侧栏评论。 */
  canWrite: boolean
  /** 首次播种用的既有正文；仅当服务端尚无快照且当前用户是作者时传入，否则为 null。 */
  seedContent: JSONContent | null
}

export interface PaperEditorProps {
  paper: PaperDetailDto
  /** 已落库的正文；调用方保证加载完成后才挂载本组件。协作模式下忽略（由 Y.Doc 提供）。 */
  content: JSONContent | null
  /** 保存正文；版本冲突时应抛出带 code===1008 的错误（后写覆盖被拒） */
  onSave?: (payload: PaperContentPayload) => Promise<void>
  /** 冲突后重新加载最新正文；由调用方重挂编辑器以载入最新内容 */
  onReloadConflict?: () => Promise<void>
  /** 导入 Markdown：把文本转成 HTML 片段返回，编辑器随即 setContent 供用户确认后保存 */
  onImportMarkdown?: (markdown: string) => Promise<string>
  /** 回滚到某条正文快照后交回覆盖后的正文，由调用方同步版本号并重挂编辑器 */
  onContentReplaced?: (dto: PaperContentDto) => void
  /** 传入即启用实时协作（Yjs over STOMP） */
  collab?: CollabConfig
}

export function PaperEditor({
  paper,
  content,
  onSave,
  onReloadConflict,
  onImportMarkdown,
  onContentReplaced,
  collab,
}: PaperEditorProps) {
  const t = useTranslations("papers")
  const tc = useTranslations("common")
  const ti = useTranslations("import")
  const locale = useLocale()
  const [mathDialog, setMathDialog] = useState<MathDialogState | null>(null)
  const [reloading, setReloading] = useState(false)
  const [showImport, setShowImport] = useState(false)
  // AI 写作建议面板的当前请求；为 null 时面板不挂载，避免空跑一次生成
  const [writingRequest, setWritingRequest] = useState<AiWritingRequest | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  // 编辑器与自动保存互相依赖：编辑器的 onUpdate 要 markDirty，而 autosave 取内容又要读编辑器。
  // 用 ref 打破这个环——autosave 通过 editorRef 读当前内容，编辑器创建时拿到稳定的 markDirty。
  const editorRef = useRef<Editor | null>(null)

  // 体积上限只在提交前自检用，拿不到就不拦（服务端照样会判）
  const limits = useContentLimits()
  const limitsRef = useRef(limits)
  limitsRef.current = limits

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
    guard: (payload) => checkContentSize(payload, limitsRef.current),
  })
  const { status, isDirty, rejection, markDirty, saveNow } = autosave

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
    () => {
      const base: Extensions = [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          // 协作模式下撤销/重做交给 Yjs 的 UndoManager，关掉本地 history 以免与 CRDT 打架。
          ...(collab ? { undoRedo: false as const } : {}),
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
      ]
      if (collab) {
        // field 必须与后续任何 Y.Doc 播种用的 XmlFragment 名一致（统一为 "default"）。
        base.push(
          Collaboration.configure({ document: collab.doc, field: "default" }),
          CollaborationCaret.configure({ provider: collab.provider, user: collab.user }),
        )
      }
      return base
    },
    // t 每次渲染都是新对象，依赖它反而会让 memo 失效；真正相关的只有下面这几项
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, footnoteTitle, bibliographyTitle, labels, onMathClick, collab],
  )

  const editor = useEditor(
    {
      extensions,
      // 协作模式下正文由 Y.Doc 承载，绝不能再喂 content，否则与 CRDT 内容叠加成重复正文。
      content: collab ? undefined : (content ?? ""),
      editable: collab ? collab.canWrite : true,
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

  // 协作首次播种：仅作者、服务端尚无快照时把既有正文写进空的 Y.Doc 并立即保存（占位为权威快照）。
  // 只在编辑器确实为空时写入，避免与已同步进来的对端内容相互覆盖。
  const seededRef = useRef(false)
  useEffect(() => {
    if (!collab || !editor || collab.seedContent == null || seededRef.current) return
    seededRef.current = true
    if (!editor.isEmpty) return
    editor.commands.setContent(collab.seedContent)
    void saveNow()
  }, [collab, editor, saveNow])

  const isSaving = status === "saving"

  /**
   * 保存被拒后显示什么：本地自检拦下的知道具体体积，能说清「多大 / 上限多少」；
   * 服务端才发现的只有业务码，退回服务端那句（已在 API 层按界面语言本地化）。
   */
  const rejectedText =
    rejection?.code === CONTENT_TOO_LARGE_CODE && rejection.size != null && rejection.limit != null
      ? t("editorContentTooLarge", {
          size: formatFileSize(rejection.size),
          limit: formatFileSize(rejection.limit),
        })
      : (rejection?.message ?? t("saveRejected"))

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

  /**
   * 回滚成功后调用方会重挂编辑器（本组件随之卸载），这里只需把结果交上去。
   * 回滚前本地必须无未保存改动，否则那份改动会在重挂后被自动保存盖掉回滚结果 ——
   * 弹层据此禁用回滚按钮，所以这里不再拦截。
   */
  const handleContentReplaced = (dto: PaperContentDto) => {
    autosave.reset()
    onContentReplaced?.(dto)
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
              <span className="ms-1.5">{ti("importMarkdown")}</span>
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => setShowHistory(true)}>
            <History className="size-4" />
            <span className="ml-1.5">{t("openContentHistory")}</span>
          </Button>
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
            {status === "rejected" && (
              <span className="flex items-center gap-1 text-xs text-red-500" data-testid="autosave-rejected">
                <AlertTriangle className="size-3" />
                {rejectedText}
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
              <span className="ms-1.5">{tc("save")}</span>
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

      <AiWritingToolbar editor={editor} onRun={setWritingRequest} />

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

      {editor && writingRequest && (
        <AiWritingPanel
          editor={editor}
          request={writingRequest}
          onClose={() => setWritingRequest(null)}
          onApplied={markDirty}
        />
      )}

      <ContentHistoryDialog
        open={showHistory}
        onClose={() => setShowHistory(false)}
        paperId={paper.id}
        getCurrentContent={() => editorRef.current?.getJSON() ?? content}
        dirty={isDirty}
        onRestored={handleContentReplaced}
      />
    </div>
  )
}
