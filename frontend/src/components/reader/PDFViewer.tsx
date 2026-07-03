"use client"

import { useTranslations } from "next-intl"
import { Upload, Link, FileText } from "lucide-react"
import type { PaperDetailDto } from "@/lib/api/types"
import { PDFReader } from "./PDFReader"

interface PDFViewerProps {
  paper?: PaperDetailDto | null
  onUploadClick?: () => void
}

export function PDFViewer({ paper, onUploadClick }: PDFViewerProps) {
  const t = useTranslations("reader")

  if (paper) {
    return <PDFReader paper={paper} />
  }

  return (
    <div className="h-full flex items-center justify-center bg-[var(--surface-1)]">
      <div className="flex flex-col items-center gap-4 p-12 rounded-2xl border-2 border-dashed border-[var(--border-color)]">
        <div className="w-16 h-16 rounded-2xl bg-[var(--surface-2)] flex items-center justify-center">
          <FileText className="w-8 h-8 text-[var(--text-tertiary)]" />
        </div>
        <div className="text-center">
          <p className="text-sm text-[var(--text-secondary)] mb-3">
            {t("noPaperSelected")}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onUploadClick}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent)] text-[var(--surface-0)] hover:opacity-90 transition-opacity"
            >
              <Upload className="w-4 h-4" />
              {t("uploadPdf")}
            </button>
            <button
              type="button"
              onClick={onUploadClick}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-all"
            >
              <Link className="w-4 h-4" />
              {t("openUrl")}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
