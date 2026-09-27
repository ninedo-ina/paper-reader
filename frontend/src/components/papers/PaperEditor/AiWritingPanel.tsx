"use client"

import { type Editor } from "@tiptap/react"
import { useLocale, useTranslations } from "next-intl"
import { Loader2, Sparkles, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/Button"
import { collectBibliography } from "@/lib/academic-numbering"
import {
  AI_WRITING_TRANSLATE_TARGETS,
  DEFAULT_TRANSLATE_TARGET,
  aiWritingActionMeta,
  applyAiWritingSuggestion,
  cleanAiWritingText,
  describeAiWritingDisclosure,
  describeAiWritingError,
  isAiWritingRangeStale,
  parseCslItems,
  providerHostLabel,
  requestAiWriting,
  sameCslIdSet,
} from "@/lib/ai-writing"
import { formatBibliographyEntry, type CslItem } from "@/lib/citations"
import { MODELS } from "@/stores/chat-store"
import { usePreferencesStore } from "@/stores/preferences-store"
import type { AiWritingRequest } from "./AiWritingToolbar"
import { replaceBibliographyEntries } from "./extensions/Citation"

export interface AiWritingPanelProps {
  editor: Editor
  request: AiWritingRequest
  onClose: () => void
  /** 建议写入正文后通知外层标脏，交给既有的自动保存链路 */
  onApplied: () => void
}

interface AiWritingSuggestion {
  text: string
  /** 参考文献建议回写文献表用的结构化结果；文本建议为 null */
  items: CslItem[] | null
}

/**
 * AI 写作建议面板。需求的两条验收线都落在这里：
 * 1. 建议先给用户看、确认后才写入正文（applyAiWritingSuggestion 只在点「写入正文」时调用）；
 * 2. 发往 Provider 的内容在 UI 上明确告知（披露块常驻，生成前后都可见）。
 *
 * 生成期间不允许关闭面板：取消请求需要 AbortSignal，主链路暂未透传，先按"等它跑完"处理。
 */
export function AiWritingPanel({ editor, request, onClose, onApplied }: AiWritingPanelProps) {
  const t = useTranslations("papers")
  const tc = useTranslations("common")
  const ta = useTranslations("assistant")
  const locale = useLocale()

  const providers = usePreferencesStore((state) => state.providers)
  const activeProviderId = usePreferencesStore((state) => state.activeProviderId)
  const provider = providers.find((entry) => entry.id === activeProviderId) ?? null
  const model = provider?.models[0]?.trim() || MODELS[0]

  const meta = aiWritingActionMeta(request.action)
  const title = t(`aiWriting_${request.action}`)

  const [targetLanguage, setTargetLanguage] = useState<string>(DEFAULT_TRANSLATE_TARGET)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<AiWritingSuggestion | null>(null)
  const [copied, setCopied] = useState(false)
  const [bibliographySize] = useState(() => collectBibliography(editor.state.doc).length)

  const documentText = useMemo(
    () => (meta.needsDocument ? editor.getText() : ""),
    [editor, meta.needsDocument],
  )
  const disclosure = describeAiWritingDisclosure(request.action, request.selection, documentText)

  const canWrite = meta.resultKind !== "report"

  const run = useCallback(
    async (language: string) => {
      if (!provider) return
      setBusy(true)
      setError(null)
      setSuggestion(null)
      try {
        const raw = await requestAiWriting(
          {
            action: request.action,
            selection: request.selection,
            document: documentText,
            targetLanguage: language,
            entries:
              meta.resultKind === "references" ? collectBibliography(editor.state.doc) : undefined,
          },
          { baseUrl: provider.baseUrl, apiKey: provider.apiKey, model },
        )

        if (meta.resultKind === "references") {
          const items = parseCslItems(raw)
          if (!items) throw new Error(t("aiWritingReferenceParseFailed"))
          if (!sameCslIdSet(collectBibliography(editor.state.doc), items)) {
            throw new Error(t("aiWritingReferenceIdMismatch"))
          }
          setSuggestion({
            text: items.map((item) => formatBibliographyEntry(item, locale)).join("\n"),
            items,
          })
        } else {
          const text = cleanAiWritingText(raw)
          if (!text) throw new Error(t("aiWritingEmpty"))
          setSuggestion({ text, items: null })
        }
      } catch (caught) {
        setError(describeAiWritingError(caught, provider.apiKey))
      } finally {
        setBusy(false)
      }
    },
    [documentText, editor, locale, meta.resultKind, model, provider, request.action, request.selection, t],
  )

  useEffect(() => {
    if (request.action === "translate") return
    void run(DEFAULT_TRANSLATE_TARGET)
    // 只在面板打开时跑一次；后续重跑由「重新生成」按钮触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [busy, onClose])

  const copy = async () => {
    if (!suggestion) return
    try {
      await navigator.clipboard.writeText(suggestion.text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // 剪贴板权限不可用时不算错误：内容就在面板里，可手动选中复制
    }
  }

  const apply = () => {
    if (!suggestion) return

    if (meta.resultKind === "references") {
      if (!suggestion.items) return
      if (!sameCslIdSet(collectBibliography(editor.state.doc), suggestion.items)) {
        setError(t("aiWritingReferenceIdMismatch"))
        return
      }
      if (replaceBibliographyEntries(editor, suggestion.items)) onApplied()
      onClose()
      return
    }

    if (isAiWritingRangeStale(editor, request.range, request.selection)) {
      setError(t("aiWritingStaleRange"))
      return
    }
    if (applyAiWritingSuggestion(editor, meta.resultKind, request.range, suggestion.text)) {
      onApplied()
    }
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={() => {
          if (!busy) onClose()
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="ai-writing-panel rounded-2xl border border-[var(--border-color)] glass-surface-strong shadow-2xl"
      >
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--border-subtle)]">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <Sparkles className="size-4 text-[var(--accent)]" />
            {title}
          </h3>
          <button
            type="button"
            className="p-1 rounded-md hover:bg-[var(--surface-2)] text-[var(--text-tertiary)] disabled:opacity-40"
            aria-label={tc("cancel")}
            disabled={busy}
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="ai-writing-disclosure">
          <p className="ai-writing-disclosure-title">{t("aiWritingDisclosureTitle")}</p>
          <ul className="ai-writing-disclosure-list">
            {disclosure.scope === "references" ? (
              <li>{t("aiWritingDisclosureReferences", { items: bibliographySize })}</li>
            ) : (
              <li>
                {disclosure.scope === "selection"
                  ? t("aiWritingDisclosureSelection", { chars: disclosure.characters })
                  : t("aiWritingDisclosureDocument", { chars: disclosure.characters })}
              </li>
            )}
            <li>
              {t("aiWritingDisclosureTarget", {
                provider: provider?.name ?? "—",
                host: provider ? providerHostLabel(provider.baseUrl) : "—",
                model,
              })}
            </li>
          </ul>
          <p className="ai-writing-disclosure-note">{t("aiWritingDisclosureNote")}</p>
          <p className="ai-writing-disclosure-note">{ta("disclaimer")}</p>
        </div>

        <div className="ai-writing-body">
          {!provider && (
            <p role="alert" className="ai-writing-error">
              {t("aiWritingTargetUnavailable")}
            </p>
          )}
          {request.action === "translate" && !suggestion && (
            <label className="ai-writing-field">
              <span>{t("aiWritingTargetLanguage")}</span>
              <select
                className="ai-writing-select"
                value={targetLanguage}
                disabled={busy}
                onChange={(event) => setTargetLanguage(event.target.value)}
              >
                {AI_WRITING_TRANSLATE_TARGETS.map((language) => (
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </select>
            </label>
          )}

          {busy && (
            <p className="ai-writing-status" role="status">
              <Loader2 className="size-4 animate-spin" />
              {t("aiWritingGenerating")}
            </p>
          )}

          {!busy && suggestion && meta.resultKind === "report" && (
            <>
              <p className="ai-writing-hint">{t("aiWritingReportHint")}</p>
              <div className="ai-writing-report" tabIndex={0}>
                {suggestion.text}
              </div>
            </>
          )}

          {!busy && suggestion && meta.resultKind === "references" && (
            <>
              <p className="ai-writing-hint">{t("aiWritingReferenceHint")}</p>
              <div className="ai-writing-report" tabIndex={0}>
                {suggestion.items?.map((item, index) => (
                  <p key={item.id} className="ai-writing-reference-line">
                    <span className="ai-writing-reference-number">{index + 1}</span>
                    {formatBibliographyEntry(item, locale)}
                  </p>
                ))}
              </div>
            </>
          )}

          {!busy && suggestion && canWrite && meta.resultKind !== "references" && (
            <>
              <p className="ai-writing-hint">{t("aiWritingApplyHint")}</p>
              <textarea
                className="ai-writing-suggestion-input"
                aria-label={t("aiWritingSuggestionLabel")}
                value={suggestion.text}
                onChange={(event) =>
                  setSuggestion({ text: event.target.value, items: suggestion.items })
                }
              />
            </>
          )}
        </div>

        {error && (
          <p role="alert" className="ai-writing-error">
            {error}
          </p>
        )}

        <footer className="flex flex-wrap items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border-subtle)]">
          <Button variant="secondary" size="sm" onClick={copy} disabled={!suggestion}>
            {copied ? t("aiWritingCopied") : t("aiWritingCopy")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || !provider}
            onClick={() => void run(targetLanguage)}
          >
            {suggestion ? t("aiWritingRegenerate") : t("aiWritingGenerate")}
          </Button>
          {canWrite ? (
            <Button size="sm" disabled={busy || !suggestion || !provider} onClick={apply}>
              {t("aiWritingApply")}
            </Button>
          ) : (
            <Button size="sm" disabled={busy} onClick={onClose}>
              {tc("confirm")}
            </Button>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  )
}
