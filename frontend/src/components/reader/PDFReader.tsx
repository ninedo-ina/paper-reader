"use client"

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { useTheme } from "next-themes"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, Maximize, Minimize, Sun, Moon, LayoutGrid } from "lucide-react"
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
import type { TextAnchor, PositionRect } from "@/components/reader/AnnotationLayer"

// 设置 pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface PDFReaderProps {
  paper: PaperDetailDto
}

type PdfLayout = 1 | 2 | 3 | 4 | 6

const PDF_LAYOUTS: Record<PdfLayout, { columns: number; step: number; label: string }> = {
  1: { columns: 1, step: 1, label: "单页" },
  2: { columns: 2, step: 2, label: "两栏" },
  3: { columns: 3, step: 3, label: "三栏" },
  4: { columns: 2, step: 4, label: "四栏" },
  6: { columns: 3, step: 6, label: "六栏" },
}

export function PDFReader({ paper }: PDFReaderProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1.2)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [chromeVisible, setChromeVisible] = useState(true)
  const { theme, setTheme } = useTheme()
  const readerTheme: "light" | "dark" = theme === "dark" ? "dark" : "light"
  const [layout, setLayout] = useState<1 | 2 | 3 | 4 | 6>(1)
  const [layoutOpen, setLayoutOpen] = useState(false)
  const [containerWidth, setContainerWidth] = useState(0)
  const [scrollbarsVisible, setScrollbarsVisible] = useState(false)
  const readerRef = useRef<HTMLDivElement>(null)
  const chromeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollbarTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const panRef = useRef({ active: false, x: 0, y: 0, left: 0, top: 0 })
  const addToast = useToastStore((s) => s.addToast)
  const {
    annotations, notes,
    addAnnotation, removeAnnotation,
    addNote, removeNote,
    loadAnnotations, loadNotes,
    navigationTarget,
    setPendingPaperQuestion,
  } = useReaderStore()

  // Load annotations & notes from API when paper changes
  useEffect(() => {
    if (paper.id) {
      loadAnnotations(paper.id)
      loadNotes(paper.id)
    }
  }, [paper.id, loadAnnotations, loadNotes])

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const update = () => setContainerWidth(element.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"annotation" | "note">("annotation")
  const [dialogText, setDialogText] = useState("")
  const [dialogPosition, setDialogPosition] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const [dialogPositions, setDialogPositions] = useState<PositionRect[]>([])
  const [dialogPage, setDialogPage] = useState(1)
  const [dialogStartOffset, setDialogStartOffset] = useState(-1)
  const [dialogEndOffset, setDialogEndOffset] = useState(-1)

  const handleCreateAnnotation = useCallback(
    (text: string, position: PositionRect, positions: PositionRect[], pageNum: number, startOffset: number, endOffset: number) => {
      setDialogMode("annotation")
      setDialogText(text)
      setDialogPosition(position)
      setDialogPositions(positions)
      setDialogPage(pageNum)
      setDialogStartOffset(startOffset)
      setDialogEndOffset(endOffset)
      setDialogOpen(true)
    }, [])

  const handleCreateNote = useCallback(
    (text: string, position: PositionRect, positions: PositionRect[], pageNum: number, startOffset: number, endOffset: number) => {
      setDialogMode("note")
      setDialogText(text)
      setDialogPosition(position)
      setDialogPositions(positions)
      setDialogPage(pageNum)
      setDialogStartOffset(startOffset)
      setDialogEndOffset(endOffset)
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
          positions: dialogPositions,
          commentCount: 0,
          createdAt: new Date().toISOString(),
        })
        try {
          const created = await createAnnotation({
            paperId: paper.id,
            pageNumber: dialogPage,
            type: "HIGHLIGHT",
            position: { ...dialogPosition, positions: dialogPositions } as unknown as Record<string, unknown>,
            text: dialogText,
            comment: data.markdown,
            images: data.images,
            quotedText: dialogText,
            startOffset: dialogStartOffset >= 0 ? dialogStartOffset : undefined,
            endOffset: dialogEndOffset >= 0 ? dialogEndOffset : undefined,
          })
          removeAnnotation(tempId)
          const createdPos = created.position as unknown as Record<string, unknown>
          addAnnotation({
            id: created.id,
            paperId: created.paperId,
            pageNumber: created.pageNumber,
            quotedText: created.quotedText || dialogText,
            content: created.comment || "",
            images: created.images || [],
            position: { x: Number(createdPos.x ?? dialogPosition.x), y: Number(createdPos.y ?? dialogPosition.y), width: Number(createdPos.width ?? dialogPosition.width), height: Number(createdPos.height ?? dialogPosition.height) },
            positions: (createdPos.positions as PositionRect[]) || dialogPositions,
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
          positions: dialogPositions,
          createdAt: new Date().toISOString(),
        })
        try {
          const created = await createNote({
            paperId: paper.id,
            pageNumber: dialogPage,
            content: data.markdown,
            images: data.images,
            quotedText: dialogText,
            position: { ...dialogPosition, positions: dialogPositions } as unknown as Record<string, unknown>,
            startOffset: dialogStartOffset >= 0 ? dialogStartOffset : undefined,
            endOffset: dialogEndOffset >= 0 ? dialogEndOffset : undefined,
          })
          removeNote(tempId)
          const createdPos = (created as unknown as Record<string, unknown>).position as Record<string, unknown> | undefined
          addNote({
            id: created.id,
            paperId: created.paperId,
            pageNumber: created.pageNumber || dialogPage,
            quotedText: created.quotedText || dialogText,
            title: created.title,
            content: created.content,
            images: created.images || [],
            position: createdPos ? { x: Number(createdPos.x ?? dialogPosition.x), y: Number(createdPos.y ?? dialogPosition.y), width: Number(createdPos.width ?? dialogPosition.width), height: Number(createdPos.height ?? dialogPosition.height) } : dialogPosition,
            positions: (createdPos?.positions as PositionRect[]) || dialogPositions,
            createdAt: created.createdAt,
          })
        } catch {
          removeNote(tempId)
          addToast({ message: "创建笔记失败", type: "error" })
        }
      }
    },
    [dialogMode, dialogText, dialogPosition, dialogPositions, dialogPage, dialogStartOffset, dialogEndOffset, paper.id, addAnnotation, removeAnnotation, addNote, removeNote, addToast],
  )

  // Build anchors from store annotations & notes for underline rendering
  const anchors: TextAnchor[] = useMemo(() => {
    const aAnchors: TextAnchor[] = annotations.map((a) => ({
      id: a.id,
      type: "annotation" as const,
      text: a.quotedText,
      pageNumber: a.pageNumber,
      position: a.position,
      positions: a.positions,
    }))
    const nAnchors: TextAnchor[] = notes.map((n) => ({
      id: n.id,
      type: "note" as const,
      text: n.quotedText,
      pageNumber: n.pageNumber,
      position: n.position,
      positions: n.positions,
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

  // Navigate to target position when clicking annotation/note card in RightPanel
  useEffect(() => {
    if (!navigationTarget || !scrollRef.current) return
    setPageNumber(navigationTarget.pageNumber)
    // After page renders, scroll to position if available
    if (navigationTarget.position) {
      const pos = navigationTarget.position
      setTimeout(() => {
        const pageEl = scrollRef.current?.querySelector(`[data-page="${navigationTarget.pageNumber}"]`)
        if (pageEl && pos.height > 0) {
          const container = scrollRef.current!
          const pageTop = pageEl.getBoundingClientRect().top - container.getBoundingClientRect().top
          const targetY = pageTop + (pos.y * pageEl.getBoundingClientRect().height) / pageEl.scrollHeight - 100
          container.scrollTo({ top: targetY, behavior: "smooth" })
        }
      }, 300)
    }
  }, [navigationTarget?.timestamp])

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

  const layoutConfig = PDF_LAYOUTS[layout]
  // Zoom remains effective in every layout. Pages larger than the viewport are
  // intentionally scrollable instead of being clipped or scaled back down.
  const pageWidth = Math.max(280, 612 * scale)
  const effectiveScale = pageWidth / 612

  const zoomToCenter = useCallback((nextScale: number) => {
    const container = scrollRef.current
    const currentScale = scale
    const clampedScale = Math.max(0.5, Math.min(3, nextScale))
    if (!container || clampedScale === currentScale) return

    // Keep the point currently at the viewport center under the center after
    // react-pdf re-renders the page at its new size.
    const centerX = container.scrollLeft + container.clientWidth / 2
    const centerY = container.scrollTop + container.clientHeight / 2
    const ratio = clampedScale / currentScale
    setScale(clampedScale)
    requestAnimationFrame(() => {
      const current = scrollRef.current
      if (!current) return
      current.scrollLeft = centerX * ratio - current.clientWidth / 2
      current.scrollTop = centerY * ratio - current.clientHeight / 2
    })
  }, [scale])

  const revealScrollbars = useCallback(() => {
    setScrollbarsVisible(true)
    if (scrollbarTimer.current) clearTimeout(scrollbarTimer.current)
    scrollbarTimer.current = setTimeout(() => setScrollbarsVisible(false), 1400)
  }, [])

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const isEmptyCanvas = (target: EventTarget | null) => {
      const element = target instanceof Element ? target : null
      return Boolean(element && !element.closest(
        ".textLayer, .react-pdf__Page__textContent, .annotationLayer, a, button, input, textarea, select",
      ))
    }

    const stopPan = () => {
      panRef.current.active = false
      container.classList.remove("pdf-reader-panning")
    }

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0 || !isEmptyCanvas(event.target)) return
      panRef.current = {
        active: true,
        x: event.clientX,
        y: event.clientY,
        left: container.scrollLeft,
        top: container.scrollTop,
      }
      container.classList.add("pdf-reader-panning")
      revealScrollbars()
    }

    const onMouseMove = (event: MouseEvent) => {
      const pan = panRef.current
      if (!pan.active) return
      event.preventDefault()
      container.scrollLeft = pan.left - (event.clientX - pan.x)
      container.scrollTop = pan.top - (event.clientY - pan.y)
    }

    container.addEventListener("mousedown", onMouseDown)
    window.addEventListener("mousemove", onMouseMove, { passive: false })
    window.addEventListener("mouseup", stopPan)
    window.addEventListener("blur", stopPan)
    return () => {
      container.removeEventListener("mousedown", onMouseDown)
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", stopPan)
      window.removeEventListener("blur", stopPan)
      stopPan()
    }
  }, [revealScrollbars])

  const layoutStart = Math.min(
    Math.max(1, pageNumber),
    Math.max(1, numPages - layoutConfig.step + 1),
  )
  const visiblePages = Array.from(
    { length: Math.min(layoutConfig.step, Math.max(0, numPages - layoutStart + 1)) },
    (_, index) => layoutStart + index,
  )

  const revealChrome = useCallback(() => {
    setChromeVisible(true)
    if (chromeTimer.current) clearTimeout(chromeTimer.current)
    if (isFullscreen) {
      chromeTimer.current = setTimeout(() => setChromeVisible(false), 2200)
    }
  }, [isFullscreen])

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else if (readerRef.current?.requestFullscreen) {
        await readerRef.current.requestFullscreen()
      } else {
        setIsFullscreen(true)
      }
    } catch {
      setIsFullscreen((value) => !value)
    }
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange)
  }, [])

  useEffect(() => {
    if (!isFullscreen) {
      setChromeVisible(true)
      document.body.style.overflow = ""
      if (chromeTimer.current) clearTimeout(chromeTimer.current)
      return
    }
    document.body.style.overflow = "hidden"
    revealChrome()
    return () => {
      document.body.style.overflow = ""
      if (chromeTimer.current) clearTimeout(chromeTimer.current)
    }
  }, [isFullscreen, revealChrome])

  return (
    <div
      ref={readerRef}
      onMouseMove={revealChrome}
      onTouchStart={revealChrome}
      className={cn(
        "relative flex h-full flex-col",
        isFullscreen && "fixed inset-0 z-50",
        readerTheme === "dark" ? "pdf-reader-dark" : "pdf-reader-light",
      )}
      style={{ background: readerTheme === "dark" ? "#111214" : "var(--surface-1)" }}
    >
      {/* Toolbar */}
      <div
        className={cn(
          "z-30 flex items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--surface-0)] px-3 py-2 transition-opacity duration-300",
          isFullscreen && "absolute inset-x-0 top-0",
          isFullscreen && !chromeVisible && "pointer-events-none opacity-0",
        )}
        onMouseMove={revealChrome}
      >
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
            onClick={() => setPageNumber((p) => Math.max(1, p - layoutConfig.step))}
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
            onClick={() => setPageNumber((p) => Math.min(Math.max(1, numPages - layoutConfig.step + 1), p + layoutConfig.step))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="flex items-center gap-0.5 ml-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={scale <= 0.5}
            onClick={() => zoomToCenter(scale - 0.1)}
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
            onClick={() => zoomToCenter(scale + 0.1)}
          >
            <ZoomIn className="size-4" />
          </Button>
        </div>
        {isFullscreen && (
          <Button variant="ghost" size="sm" onClick={() => setTheme(readerTheme === "light" ? "dark" : "light")} title={readerTheme === "light" ? "切换夜间模式" : "切换白天模式"}>
            {readerTheme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
          </Button>
        )}
        <div className="relative">
          <Button variant="ghost" size="sm" onClick={() => { setLayoutOpen((open) => !open); revealChrome() }} title="分页布局" aria-label="分页布局">
            <LayoutGrid className="size-4" />
          </Button>
          {layoutOpen && <div className="absolute right-0 top-full z-50 mt-1 flex gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--surface-0)] p-1 shadow-xl">
            {([1, 2, 3, 4, 6] as PdfLayout[]).map((value) => (
              <button key={value} type="button" onClick={() => { setLayout(value); setLayoutOpen(false); revealChrome() }} className={cn("rounded px-2 py-1 text-xs whitespace-nowrap hover:bg-[var(--bg-hover)]", layout === value && "bg-[var(--accent)] text-[var(--surface-0)]")}>
                {PDF_LAYOUTS[value].label}
              </button>
            ))}
          </div>}
        </div>
        <Button variant="ghost" size="sm" onClick={() => void toggleFullscreen()} title={isFullscreen ? "退出全屏" : "全屏阅读"}>
          {isFullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
        </Button>
      </div>

      {/* PDF Canvas */}
      <div
        ref={scrollRef}
        onScroll={revealScrollbars}
        onMouseEnter={revealScrollbars}
        onWheel={revealScrollbars}
        className={cn(
          "min-h-0 min-w-0 flex-1 overflow-auto pdf-reader-scroll",
          !scrollbarsVisible && "pdf-reader-scroll-hidden",
          readerTheme === "dark" ? "bg-[#111214]" : "bg-[var(--bg-root)]",
        )}
      >
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
          className={cn(
            "grid w-max min-w-full grid-flow-row items-start gap-4 p-4",
            layoutConfig.columns === 1
              ? "grid-cols-1 justify-items-center"
              : layoutConfig.columns === 2
                ? "grid-cols-2 justify-items-center"
                : "grid-cols-3 justify-items-center",
          )}
        >
          {visiblePages
            .map((n) => (
              <div
                key={`${n}-${layout}`}
                data-page={n}
                style={{ width: pageWidth, minWidth: pageWidth }}
                className={cn(
                  "shrink-0 shadow-lg transition-opacity duration-200",
                  readerTheme === "dark" ? "bg-[#1b1c20]" : "bg-white",
                )}
              >
                <AnnotationLayer
                  pageNumber={n}
                  anchors={anchors}
                  scale={effectiveScale}
                  layoutKey={`${layout}:${containerWidth}`}
                  onCreateAnnotation={(text, pos, positions, startOffset, endOffset) => handleCreateAnnotation(text, pos, positions, n, startOffset, endOffset)}
                  onCreateNote={(text, pos, positions, startOffset, endOffset) => handleCreateNote(text, pos, positions, n, startOffset, endOffset)}
                  onAskAI={(text, selectedPage) => setPendingPaperQuestion({
                    paperId: paper.id,
                    paperTitle: paper.title,
                    selectedText: text,
                    pageNumber: selectedPage,
                  })}
                >
                  <Page
                    pageNumber={n}
                    width={pageWidth}
                    // The bundled PDF.js HCM filter is not reliable in every
                    // browser (and can leave the canvas/text layer washed out).
                    // Render the normal page, then invert the canvas only in
                    // dark mode; the text layer remains transparent/selectable.
                    pageColors={undefined}
                    canvasBackground="#ffffff"
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    className={readerTheme === "dark" ? "bg-[#1b1c20]" : "bg-white"}
                  />
                </AnnotationLayer>
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
