"use client"

import { useState, type ReactNode } from "react"
import { useEditorState, type Editor } from "@tiptap/react"
import { useTranslations } from "next-intl"
import {
  BookMarked,
  Columns3,
  Crosshair,
  Radical,
  Rows3,
  Sigma,
  Superscript,
  Table2,
  Trash2,
} from "lucide-react"
import { collectNumberedTargets, CROSS_REFERENCE_NODE } from "@/lib/academic-numbering"
import type { CslItem } from "@/lib/citations"
import { AcademicPromptDialog } from "./AcademicPromptDialog"
import { CitationPickerDialog } from "./CitationPickerDialog"
import { insertCitation } from "./extensions/Citation"
import { crossReferenceText, type CrossReferenceLabels } from "./extensions/CrossReference"
import { insertFootnote } from "./extensions/Footnote"

export interface AcademicToolbarProps {
  editor: Editor | null
  labels: CrossReferenceLabels
  /** 公式弹层的状态由 PaperEditor 持有：扩展里的 onClick 是在那边配置的，只能由它来开弹层 */
  mathDialog: MathDialogState | null
  onOpenMathDialog: (state: MathDialogState | null) => void
}

type MathKind = "inlineMath" | "blockMath"

export interface MathDialogState {
  kind: MathKind
  /** 点已有公式进入编辑时为该节点位置，插入新公式时为 null */
  pos: number | null
  latex: string
}

function ToolbarButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="academic-toolbar-button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/**
 * 学术写作工具栏。公式走"点击节点即编辑"（官方 NodeView 的 onClick 钩子），
 * 所以工具栏上的公式按钮只负责插入，不必再判断光标是不是落在某个公式上。
 */
export function AcademicToolbar({
  editor,
  labels,
  mathDialog,
  onOpenMathDialog,
}: AcademicToolbarProps) {
  const t = useTranslations("papers")
  const [footnoteOpen, setFootnoteOpen] = useState(false)
  const [citationOpen, setCitationOpen] = useState(false)
  const [crossRefOpen, setCrossRefOpen] = useState(false)

  const inTable = useEditorState({
    editor,
    selector: ({ editor: instance }) => instance?.isActive("table") ?? false,
  })

  const targets = crossRefOpen && editor ? collectNumberedTargets(editor.state.doc) : []

  const openMathDialog = (kind: MathKind) => onOpenMathDialog({ kind, latex: "", pos: null })

  const submitMath = (latex: string) => {
    if (!editor || !mathDialog) return
    const chain = editor.chain().focus()
    if (mathDialog.kind === "inlineMath") {
      if (mathDialog.pos == null) chain.insertInlineMath({ latex }).run()
      else chain.updateInlineMath({ latex, pos: mathDialog.pos }).run()
    } else if (mathDialog.pos == null) {
      chain.insertBlockMath({ latex }).run()
    } else {
      chain.updateBlockMath({ latex, pos: mathDialog.pos }).run()
    }
    onOpenMathDialog(null)
  }

  const submitCitation = (item: CslItem) => {
    if (editor) insertCitation(editor, item)
    setCitationOpen(false)
  }

  const insertCrossReference = (targetId: string, kind: string, number: number | null) => {
    if (!editor) return
    editor
      .chain()
      .focus()
      .insertContent({ type: CROSS_REFERENCE_NODE, attrs: { targetId, kind, number } })
      .run()
    setCrossRefOpen(false)
  }

  return (
    <div className="academic-toolbar" role="toolbar" aria-label={t("academicToolbar")}>
      <ToolbarButton label={t("insertInlineMath")} disabled={!editor} onClick={() => openMathDialog("inlineMath")}>
        <Sigma className="size-4" />
      </ToolbarButton>
      <ToolbarButton label={t("insertBlockMath")} disabled={!editor} onClick={() => openMathDialog("blockMath")}>
        <Radical className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={t("insertTable")}
        disabled={!editor || inTable === true}
        onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        <Table2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton label={t("insertFootnote")} disabled={!editor} onClick={() => setFootnoteOpen(true)}>
        <Superscript className="size-4" />
      </ToolbarButton>
      <ToolbarButton label={t("insertCitation")} disabled={!editor} onClick={() => setCitationOpen(true)}>
        <BookMarked className="size-4" />
      </ToolbarButton>

      <div className="relative">
        <ToolbarButton
          label={t("insertCrossReference")}
          disabled={!editor}
          onClick={() => setCrossRefOpen((open) => !open)}
        >
          <Crosshair className="size-4" />
        </ToolbarButton>
        {crossRefOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setCrossRefOpen(false)} />
            <div className="absolute start-0 top-full z-50 mt-1 min-w-52 rounded-xl border border-[var(--border-color)] glass-surface-strong p-1 shadow-2xl">
              {targets.length === 0 ? (
                <p className="px-3 py-2 text-xs text-[var(--text-tertiary)]">
                  {t("crossReferenceEmpty")}
                </p>
              ) : (
                targets.map((target) => (
                  <button
                    key={target.id}
                    type="button"
                    className="block w-full rounded-lg px-3 py-1.5 text-start text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                    onClick={() => insertCrossReference(target.id, target.kind, target.number)}
                  >
                    {crossReferenceText(labels, target.kind, target.number)}
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {inTable === true && (
        <span className="academic-toolbar-group">
          <ToolbarButton
            label={t("tableAddRow")}
            onClick={() => editor?.chain().focus().addRowAfter().run()}
          >
            <Rows3 className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label={t("tableAddColumn")}
            onClick={() => editor?.chain().focus().addColumnAfter().run()}
          >
            <Columns3 className="size-4" />
          </ToolbarButton>
          <ToolbarButton label={t("tableDelete")} onClick={() => editor?.chain().focus().deleteTable().run()}>
            <Trash2 className="size-4" />
          </ToolbarButton>
        </span>
      )}

      {mathDialog && (
        <AcademicPromptDialog
          title={t("mathLatexLabel")}
          label={t("mathLatexLabel")}
          placeholder={t("mathLatexPlaceholder")}
          initialValue={mathDialog.latex}
          multiline
          emptyError={t("mathEmpty")}
          confirmLabel={mathDialog.pos == null ? t("academicInsert") : t("academicUpdate")}
          onConfirm={submitMath}
          onClose={() => onOpenMathDialog(null)}
        />
      )}

      {footnoteOpen && (
        <AcademicPromptDialog
          title={t("footnoteLabel")}
          label={t("footnoteLabel")}
          placeholder={t("footnotePlaceholder")}
          multiline
          emptyError={t("footnoteEmptyInput")}
          confirmLabel={t("academicInsert")}
          onConfirm={(note) => {
            if (editor) insertFootnote(editor, note)
            setFootnoteOpen(false)
          }}
          onClose={() => setFootnoteOpen(false)}
        />
      )}

      {citationOpen && (
        <CitationPickerDialog onSelect={submitCitation} onClose={() => setCitationOpen(false)} />
      )}
    </div>
  )
}
