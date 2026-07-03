"use client"

import { useState, useCallback } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"
import type { PaperDetailDto } from "@/lib/api/types"
import { getDownloadUrl } from "@/lib/api/papers"

// 设置 pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface PDFReaderProps {
  paper: PaperDetailDto
}

export function PDFReader({ paper }: PDFReaderProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1.2)
  const [loadingProgress, setLoadingProgress] = useState(0)

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    if (paper.pageCount && paper.pageCount !== numPages) {
      // backend pageCount may differ from actual pages
    }
  }, [paper.pageCount])

  const pdfUrl = getDownloadUrl(paper.id)

  return (
    <div className="h-full flex flex-col bg-[var(--surface-1)]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--surface-0)]">
        <h1 className="text-sm font-medium text-[var(--text-primary)] truncate flex-1">
          {paper.title || "Untitled"}
        </h1>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-xs text-[var(--text-secondary)] min-w-[60px] text-center tabular-nums">
            {numPages > 0 ? `${pageNumber}/${numPages}` : "—"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={pageNumber >= numPages}
            onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="flex items-center gap-0.5 ml-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={scale <= 0.5}
            onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
          >
            <ZoomOut className="size-4" />
          </Button>
          <span className="text-xs text-[var(--text-tertiary)] w-10 text-center tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={scale >= 3}
            onClick={() => setScale((s) => Math.min(3, s + 0.1))}
          >
            <ZoomIn className="size-4" />
          </Button>
        </div>
      </div>

      {/* PDF Canvas */}
      <div className="flex-1 overflow-auto flex justify-center" style={{ background: "var(--bg-root)" }}>
        <Document
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadProgress={({ loaded, total }) => {
            if (total) setLoadingProgress(Math.round((loaded / total) * 100))
          }}
          loading={
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <Loader2 className="size-8 animate-spin text-[var(--text-tertiary)]" />
              {loadingProgress > 0 && (
                <p className="text-xs text-[var(--text-tertiary)]">{loadingProgress}%</p>
              )}
            </div>
          }
          error={
            <p className="text-sm text-red-500 p-8">
              Failed to load PDF. Check the file URL or backend.
            </p>
          }
          className="flex flex-col items-center py-4"
        >
          {Array.from({ length: numPages }, (_, i) => i + 1)
            .filter((n) => Math.abs(n - pageNumber) <= 1)
            .map((n) => (
              <div
                key={n}
                className={cn(
                  "shadow-lg mb-4 transition-opacity duration-200",
                  n !== pageNumber && "opacity-50",
                )}
              >
                <Page
                  pageNumber={n}
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  className="bg-white"
                />
              </div>
            ))}
        </Document>
      </div>
    </div>
  )
}
