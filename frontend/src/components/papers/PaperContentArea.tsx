"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import type { JSONContent } from "@tiptap/react"
import { PDFViewer } from "@/components/reader/PDFViewer"
import { PaperEditor } from "@/components/papers/PaperEditor/PaperEditor"
import type { PaperContentPayload } from "@/components/papers/PaperEditor/PaperEditor"
import * as papersApi from "@/lib/api/papers"
import type { PaperDetailDto } from "@/lib/api/types"

interface PaperContentAreaProps {
  paper: PaperDetailDto | null
  onUploadClick?: () => void
}

export function PaperContentArea({ paper, onUploadClick }: PaperContentAreaProps) {
  const t = useTranslations("papers")
  const tc = useTranslations("common")

  const paperId = paper?.id ?? null
  const isManual = paper?.sourceType === "MANUAL"

  const [content, setContent] = useState<JSONContent | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (paperId === null || !isManual) return
    let cancelled = false
    setIsLoading(true)
    setLoadFailed(false)
    setContent(null)
    papersApi
      .getPaperContent(paperId)
      .then((dto) => {
        if (!cancelled) setContent(dto.contentJson)
      })
      .catch(() => {
        // 读取失败时不能退化成空编辑器：用户会在空白里继续写，保存即覆盖真实正文。
        if (!cancelled) setLoadFailed(true)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [paperId, isManual])

  const handleSave = useCallback(
    async (payload: PaperContentPayload) => {
      if (paperId === null) return
      await papersApi.updatePaperContent(paperId, payload)
    },
    [paperId],
  )

  if (!paper) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: "var(--bg-root)" }}>
        <p className="text-sm text-[var(--text-tertiary)]">
          {t("noPaperSelected")}
        </p>
      </div>
    )
  }

  if (paper.sourceType === "MANUAL") {
    if (loadFailed) {
      return (
        <div className="flex-1 flex items-center justify-center" style={{ background: "var(--bg-root)" }}>
          <p className="text-sm text-[var(--text-tertiary)]">{t("contentLoadFailed")}</p>
        </div>
      )
    }

    if (isLoading) {
      return (
        <div className="flex-1 flex items-center justify-center" style={{ background: "var(--bg-root)" }}>
          <p className="text-sm text-[var(--text-tertiary)]">{tc("loadingEditor")}</p>
        </div>
      )
    }

    // key 按论文区分：换论文必须重建编辑器实例，否则会沿用上一篇的内容。
    return <PaperEditor key={paper.id} paper={paper} content={content} onSave={handleSave} />
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[var(--border-subtle)] bg-[var(--surface-0)]">
        <button
          type="button"
          className="px-3 py-1 rounded text-xs font-medium bg-[var(--accent)]/10 text-[var(--accent)]"
        >
          {t("pdfView")}
        </button>
      </div>

      <PDFViewer paper={paper} onUploadClick={onUploadClick} />
    </div>
  )
}
