"use client"

import { useEditorState, type Editor } from "@tiptap/react"
import { useTranslations } from "next-intl"
import { Sparkles } from "lucide-react"
import { useState } from "react"
import { collectBibliography } from "@/lib/academic-numbering"
import { AI_WRITING_ACTIONS, type AiWritingActionId } from "@/lib/ai-writing"
import { usePreferencesStore } from "@/stores/preferences-store"

/**
 * 生成建议前那一刻的正文快照。选区坐标会在确认写入时复核（见 isAiWritingRangeStale），
 * 生成期间用户改过正文就作废，避免把建议写到错的段落上。
 */
export interface AiWritingRequest {
  action: AiWritingActionId
  range: { from: number; to: number }
  selection: string
  needsDocument: boolean
}

export interface AiWritingToolbarProps {
  editor: Editor | null
  onRun: (request: AiWritingRequest) => void
}

export function AiWritingToolbar({ editor, onRun }: AiWritingToolbarProps) {
  const t = useTranslations("papers")
  const providers = usePreferencesStore((state) => state.providers)
  const activeProviderId = usePreferencesStore((state) => state.activeProviderId)
  const [open, setOpen] = useState(false)

  const state = useEditorState({
    editor,
    selector: ({ editor: instance }) => {
      if (!instance) return null
      const { from, to, empty } = instance.state.selection
      return {
        from,
        to,
        hasSelection: !empty,
        selection: instance.state.doc.textBetween(from, to, "\n"),
        bibliographySize: collectBibliography(instance.state.doc).length,
      }
    },
  })

  if (!editor || !state) return null

  const hasProvider = providers.some((provider) => provider.id === activeProviderId)

  return (
    <div className="ai-writing-toolbar" role="toolbar" aria-label={t("aiWritingToolbar")}>
      <div className="ai-writing-anchor">
        <button
          type="button"
          className="ai-writing-trigger"
          aria-haspopup="menu"
          aria-expanded={open}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setOpen((value) => !value)}
        >
          <Sparkles className="size-4" />
          <span>{t("aiWritingToolbar")}</span>
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="ai-writing-menu" role="menu" aria-label={t("aiWritingToolbar")}>
              {AI_WRITING_ACTIONS.map((action) => {
                const missingSelection = action.needsSelection && !state.hasSelection
                const missingBibliography =
                  action.resultKind === "references" && state.bibliographySize === 0
                const disabled = !hasProvider || missingSelection || missingBibliography

                return (
                  <button
                    key={action.id}
                    type="button"
                    role="menuitem"
                    className="ai-writing-menu-item"
                    disabled={disabled}
                    onClick={() => {
                      setOpen(false)
                      onRun({
                        action: action.id,
                        range: { from: state.from, to: state.to },
                        selection: state.selection,
                        needsDocument: action.needsDocument,
                      })
                    }}
                  >
                    <span>{t(`aiWriting_${action.id}`)}</span>
                    {missingSelection && (
                      <span className="ai-writing-menu-hint">{t("aiWritingNeedSelection")}</span>
                    )}
                    {missingBibliography && (
                      <span className="ai-writing-menu-hint">{t("aiWritingNeedBibliography")}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      <span className="ai-writing-note">
        {hasProvider ? t("aiWritingToolbarHint") : t("aiWritingNeedProvider")}
      </span>
    </div>
  )
}
