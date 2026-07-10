"use client"

import { useState, useLayoutEffect } from "react"
import { useTranslations } from "next-intl"
import { usePaperStore } from "@/stores/paper-store"
import { PDFViewer } from "@/components/reader/PDFViewer"
import { PaperEditor } from "@/components/papers/PaperEditor/PaperEditor"
import { PaperDetailPanel } from "@/components/papers/PaperDetailPanel"
import type { PaperDetailDto } from "@/lib/api/types"

type ContentView = "pdf" | "info"

interface PaperContentAreaProps {
  paper: PaperDetailDto | null
  onUploadClick?: () => void
}

export function PaperContentArea({ paper, onUploadClick }: PaperContentAreaProps) {
  const t = useTranslations("papers")
  const consumeShowInfoPanel = usePaperStore((s) => s.consumeShowInfoPanel)
  const [view, setView] = useState<ContentView>("pdf")

  useLayoutEffect(() => {
    if (consumeShowInfoPanel()) {
      setView("info")
    } else {
      setView("pdf")
    }
  }, [paper?.id])

  if (!paper) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: "var(--bg-root)" }}>
        <p className="text-sm text-[var(--text-tertiary)]">
          {t("noPaperSelected")}
        </p>
      </div>
    )
  }

  // MANUAL sourceType → PaperEditor
  if (paper.sourceType === "MANUAL") {
    return <PaperEditor paper={paper} />
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toggle bar for UPLOAD/URL papers */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[var(--border-subtle)] bg-[var(--surface-0)]">
        <button
          type="button"
          onClick={() => setView("pdf")}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            view === "pdf"
              ? "bg-[var(--accent)]/10 text-[var(--accent)]"
              : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          }`}
        >
          {t("pdfView")}
        </button>
        <button
          type="button"
          onClick={() => setView("info")}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            view === "info"
              ? "bg-[var(--accent)]/10 text-[var(--accent)]"
              : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          }`}
        >
          {t("paperInfo")}
        </button>
      </div>

      {view === "pdf" ? (
        <PDFViewer paper={paper} onUploadClick={onUploadClick} />
      ) : (
        <PaperDetailPanel paper={paper} />
      )}
    </div>
  )
}
