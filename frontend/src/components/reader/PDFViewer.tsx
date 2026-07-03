"use client"

import dynamic from "next/dynamic"
import { useTranslations } from "next-intl"
import { Upload } from "lucide-react"
import type { PaperDetailDto } from "@/lib/api/types"

const PDFReader = dynamic(() => import("./PDFReader").then((m) => m.PDFReader), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center" style={{ background: "var(--bg-root)" }}>
      <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Loading PDF…</p>
    </div>
  ),
})

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
    <div className="h-full flex items-center justify-center" style={{ background: "var(--bg-root)" }}>
      <div className="flex flex-col items-center gap-3 p-10 rounded-[16px] text-center"
        style={{ background: "var(--bg-glass)", backdropFilter: "blur(12px)" }}>
        <Upload className="w-12 h-12" style={{ color: "var(--text-tertiary)", strokeWidth: 1.2 }} />
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {t("noPaperSelected")}
        </p>
        <button
          type="button"
          onClick={onUploadClick}
          className="mt-1 px-6 py-2.5 rounded-[20px] text-sm font-[560] transition-all hover:-translate-y-px"
          style={{ background: "var(--accent)", color: "var(--bg-root, #eeeff2)", boxShadow: "var(--shadow-md)" }}
        >
          {t("uploadPdf")}
        </button>
        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          支持 PDF 直链 | 本地上传
        </p>
      </div>
    </div>
  )
}
