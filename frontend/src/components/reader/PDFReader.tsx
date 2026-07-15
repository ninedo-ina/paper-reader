"use client"

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { cn, copyToClipboard } from "@/lib/utils"
import type { PaperDetailDto } from "@/lib/api/types"
import { getDownloadUrl } from "@/lib/api/papers"
import { getAccessToken } from "@/lib/api/client"
import { useToastStore } from "@/stores/toast-store"
import { useReaderStore } from "@/stores/reader-store"
import { createAnnotation } from "@/lib/api/annotations"
import { createNote } from "@/lib/api/notes"
import { AnnotationLayer } from "@/components/reader/AnnotationLayer"
import { AnnotationDialog } from "@/components/reader/AnnotationDialog"
import type { TextAnchor } from "@/components/reader/AnnotationLayer"

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
  const scrollRef = useRef<HTMLDivElement>(null)
  const addToast = useToastStore((s) => s.addToast)
  const {
    annotations, notes,
    addAnnotation, removeAnnotation,
    addNote, removeNote,
    loadAnnotations, loadNotes,
  } = useReaderStore()

  // Load annotations & notes from API when paper changes
  useEffect(() => {
    if (paper.id) {
      loadAnnotations(paper.id)
      loadNotes(paper.id)
    }
  }, [paper.id, loadAnnotations, loadNotes])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"annotation" | "note">("annotation")
  const [dialogText, setDialogText] = useState("")
  const [dialogPosition, setDialogPosition] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const [dialogPage, setDialogPage] = useState(1)

  const handleCreateAnnotation = useCallback(
    (text: string, position: { x: number; y: number; width: number; height: number }, pageNum: number) => {
      setDialogMode("annotation")
      setDialogText(text)
      setDialogPosition(position)
      setDialogPage(pageNum)
      setDialogOpen(true)
    }, [])

  const handleCreateNote = useCallback(
    (text: string, position: { x: number; y: number; width: number; height: number }, pageNum: number) => {
      setDialogMode("note")
      setDialogText(text)
      setDialogPosition(position)
      setDialogPage(pageNum)
      setDialogOpen(true)
    }, [])

  const handleDialogSubmit = useCallback(
    async (data: { markdown: string; images: string[] }) => {
      const tempId = Date.now()
      if (dialogMode === "annotation") {
        // Optimistic update with temp ID
        addAnnotation({
          id: tempId,
          paperId: paper.id,
          pageNumber: dialogPage,
          quotedText: dialogText,
          content: data.markdown,
          images: data.images,
          position: dialogPosition,
          commentCount: 0,
          createdAt: new Date().toISOString(),
        })
        try {
          const created = await createAnnotation({
            paperId: paper.id,
            pageNumber: dialogPage,
            type: "HIGHLIGHT",
            position: dialogPosition,
            text: dialogText,
            comment: data.markdown,
            images: data.images,
            quotedText: dialogText,
          })
          removeAnnotation(tempId)
          addAnnotation({
            id: created.id,
            paperId: created.paperId,
            pageNumber: created.pageNumber,
            quotedText: created.quotedText || dialogText,
            content: created.comment || "",
            images: created.images || [],
            position: created.position as { x: number; y: number; width: number; height: number },
            commentCount: created.commentCount || 0,
            createdAt: created.createdAt,
          })
        } catch {
          removeAnnotation(tempId)
          addToast({ message: "创建批注失败", type: "error" })
        }
      } else {
        addNote({
          id: tempId,
          paperId: paper.id,
          pageNumber: dialogPage,
          quotedText: dialogText,
          content: data.markdown,
          images: data.images,
          position: dialogPosition,
          createdAt: new Date().toISOString(),
        })
        try {
          const created = await createNote({
            paperId: paper.id,
            pageNumber: dialogPage,
            content: data.markdown,
            images: data.images,
            quotedText: dialogText,
          })
          removeNote(tempId)
          addNote({
            id: created.id,
            paperId: created.paperId,
            pageNumber: created.pageNumber || dialogPage,
            quotedText: created.quotedText || dialogText,
            title: created.title,
            content: created.content,
            images: created.images || [],
            position: dialogPosition,
            createdAt: created.createdAt,
          })
        } catch {
          removeNote(tempId)
          addToast({ message: "创建笔记失败", type: "error" })
        }
      }
    },
    [dialogMode, dialogText, dialogPosition, dialogPage, paper.id, addAnnotation, removeAnnotation, addNote, removeNote, addToast],
  )

  // Build anchors from store annotations & notes for underline rendering
  const anchors: TextAnchor[] = useMemo(() => {
    const aAnchors: TextAnchor[] = annotations.map((a) => ({
      id: a.id,
      type: "annotation" as const,
      text: a.quotedText,
      pageNumber: a.pageNumber,
      position: a.position,
    }))
    const nAnchors: TextAnchor[] = notes.map((n) => ({
      id: n.id,
      type: "note" as const,
      text: n.quotedText,
      pageNumber: n.pageNumber,
      position: n.position,
    }))
    return [...aAnchors, ...nAnchors]
  }, [annotations, notes])

  useEffect(() => {
    if (!scrollRef.current) return
    const pageEl = scrollRef.current.querySelector(`[data-page="${pageNumber}"]`)
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [pageNumber])

  const handleCopyTitle = () => {
    const title = paper.title || ""
    copyToClipboard(title).then(() => {
      addToast({ message: "复制论文标题成功", type: "success" })
    })
  }

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    if (paper.pageCount && paper.pageCount !== numPages) {
      // backend pageCount may differ from actual pages
    }
  }, [paper.pageCount])

  const pdfUrl = getDownloadUrl(paper.id)

  // react-pdf 直接 fetch PDF 不经过我们封装的 client，需手动附加 JWT
  const file = useMemo(() => {
    const token = getAccessToken()
    if (!token) return pdfUrl
    return { url: pdfUrl, httpHeaders: { Authorization: `Bearer ${token}` } }
  }, [pdfUrl])

  return (
    <div className="h-full flex flex-col bg-[var(--surface-1)]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--surface-0)]">
        <h1
          className="text-sm font-medium text-[var(--text-primary)] truncate flex-1 cursor-pointer"
          onClick={handleCopyTitle}
          title="点击复制论文标题"
        >
          {paper.title || "Untitled"}
          {paper.authors && (
            <>
              <span className="font-normal text-[var(--text-tertiary)]"> {" / "} </span>
              <span className="font-normal text-[var(--text-secondary)]">
                {paper.authors.split(",")[0]?.trim()}
              </span>
            </>
          )}
          {paper.participants && (
            <span className="font-normal text-[var(--text-tertiary)]">
              {"（"}{paper.participants}{"）"}
            </span>
          )}
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
      <div ref={scrollRef} className="flex-1 overflow-auto flex justify-center" style={{ background: "var(--bg-root)" }}>
        <Document
          file={file}
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
                data-page={n}
                className={cn(
                  "shadow-lg mb-4 transition-opacity duration-200 relative",
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
                <AnnotationLayer
                  pageNumber={n}
                  anchors={anchors}
                  onCreateAnnotation={(text, pos) => handleCreateAnnotation(text, pos, n)}
                  onCreateNote={(text, pos) => handleCreateNote(text, pos, n)}
                />
              </div>
            ))}
        </Document>
      </div>

      <AnnotationDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleDialogSubmit}
        mode={dialogMode}
        selectedText={dialogText}
      />
    </div>
  )
}
