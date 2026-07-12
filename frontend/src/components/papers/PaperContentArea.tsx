"use client"

import { useTranslations } from "next-intl"
import { PDFViewer } from "@/components/reader/PDFViewer"
import { PaperEditor } from "@/components/papers/PaperEditor/PaperEditor"
import type { PaperDetailDto } from "@/lib/api/types"

interface PaperContentAreaProps {
  paper: PaperDetailDto | null
  onUploadClick?: () => void
}

export function PaperContentArea({ paper, onUploadClick }: PaperContentAreaProps) {
  const t = useTranslations("papers")

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
    return <PaperEditor paper={paper} />
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
