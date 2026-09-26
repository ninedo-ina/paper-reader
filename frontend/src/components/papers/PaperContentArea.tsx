"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
  // 冲突后重新加载时递增，逼编辑器重建以载入最新正文（编辑器只在挂载时读一次 content）。
  const [reloadSeq, setReloadSeq] = useState(0)
  // 本地已知的正文版本号，每次保存都带上去。服务端据此判断后写覆盖，冲突时回 409/1008。
  const versionRef = useRef(0)

  useEffect(() => {
    if (paperId === null || !isManual) return
    let cancelled = false
    setIsLoading(true)
    setLoadFailed(false)
    setContent(null)
    papersApi
      .getPaperContent(paperId)
      .then((dto) => {
        if (cancelled) return
        versionRef.current = dto.contentVersion
        setContent(dto.contentJson)
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
      const dto = await papersApi.updatePaperContent(paperId, {
        // 版本冲突时这里会抛出 code=1008 的错误，交由 useAutosave 判成 conflict 并提示用户。
        ...payload,
        baseVersion: versionRef.current,
      })
      versionRef.current = dto.contentVersion
    },
    [paperId],
  )

  /** 冲突后拉取服务端最新正文，并重建编辑器；本地未保存的改动随之丢弃（用户是主动选择「加载最新」）。 */
  const handleReloadConflict = useCallback(async () => {
    if (paperId === null) return
    const dto = await papersApi.getPaperContent(paperId)
    versionRef.current = dto.contentVersion
    setContent(dto.contentJson)
    setReloadSeq((n) => n + 1)
  }, [paperId])

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

    // key 按论文 + 重载序号区分：换论文或冲突后重载都必须重建编辑器实例，
    // 否则会沿用上一篇 / 冲突前的旧内容。
    return (
      <PaperEditor
        key={`${paper.id}-${reloadSeq}`}
        paper={paper}
        content={content}
        onSave={handleSave}
        onReloadConflict={handleReloadConflict}
      />
    )
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
