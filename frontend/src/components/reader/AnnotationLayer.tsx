"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { MessageSquare, StickyNote, Bot, Copy } from "lucide-react"
import { copyToClipboard } from "@/lib/utils"
import { useToastStore } from "@/stores/toast-store"

export type AnchorType = "annotation" | "note"

export interface PositionRect {
  x: number
  y: number
  width: number
  height: number
}

export interface TextAnchor {
  id: number
  type: AnchorType
  text: string
  pageNumber: number
  position: PositionRect
  positions?: PositionRect[]
}

interface AnnotationLayerProps {
  pageNumber: number
  anchors: TextAnchor[]
  scale: number
  children?: React.ReactNode
  onCreateAnnotation?: (text: string, position: PositionRect, positions: PositionRect[], pageNumber: number, startOffset: number, endOffset: number) => void
  onCreateNote?: (text: string, position: PositionRect, positions: PositionRect[], pageNumber: number, startOffset: number, endOffset: number) => void
  onAskAI?: (text: string) => void
}

interface PopupMenuState {
  x: number
  y: number
  text: string
  positions: PositionRect[]
  startOffset: number
  endOffset: number
}

/** Convert viewport-absolute rects to layer-relative coordinates */
function toLayerRelative(rects: PositionRect[], layerRect: DOMRect): PositionRect[] {
  return rects.map((r) => ({
    x: r.x - layerRect.left,
    y: r.y - layerRect.top,
    width: r.width,
    height: r.height,
  }))
}

/** Extract visible rects from the current selection range */
function getSelectionRects(): PositionRect[] {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !sel.toString().trim()) return []
  const range = sel.getRangeAt(0)
  const rects = range.getClientRects()
  const result: PositionRect[] = []
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]
    if (r.width > 0 && r.height > 0) {
      result.push({ x: r.left, y: r.top, width: r.width, height: r.height })
    }
  }
  return result
}

/** Compute a single bounding rect from multiple rects */
function boundingRect(rects: PositionRect[]): PositionRect {
  if (rects.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
  let x = rects[0].x, y = rects[0].y
  let x2 = rects[0].x + rects[0].width
  let y2 = rects[0].y + rects[0].height
  for (const r of rects) {
    if (r.x < x) x = r.x
    if (r.y < y) y = r.y
    if (r.x + r.width > x2) x2 = r.x + r.width
    if (r.y + r.height > y2) y2 = r.y + r.height
  }
  return { x, y, width: x2 - x, height: y2 - y }
}

interface TextMatchResult {
  rects: PositionRect[]
  startOffset: number
  endOffset: number
}

/**
 * Find text positions in the PDF text layer by matching quotedText.
 * Uses direct span matching: queries all [role="presentation"] spans, concatenates
 * their textContent for search, then uses Range on matching span text nodes for
 * precise viewport coordinates via getClientRects().
 * Also returns startOffset/endOffset — the character offsets of the match within
 * the concatenated full text of the page.
 */
function findTextPositions(textLayer: HTMLElement, searchText: string): TextMatchResult {
  const empty = { rects: [], startOffset: -1, endOffset: -1 }
  if (!searchText) return empty

  const spans = textLayer.querySelectorAll<HTMLElement>('[role="presentation"]')
  if (spans.length === 0) return empty

  // Build span entries with text and offset info
  const entries: Array<{ el: HTMLElement; text: string; start: number; end: number }> = []
  let fullText = ""
  let offset = 0

  for (const span of spans) {
    const text = span.textContent || ""
    if (text.length > 0) {
      entries.push({ el: span, text, start: offset, end: offset + text.length })
      fullText += text
      offset += text.length
    }
  }

  if (fullText.length === 0) return empty

  const norm = (s: string) => s.normalize("NFKD").replace(/\s+/g, " ").replace(/[̀-ͯ]/g, "")
  const stripInvisible = (s: string) => s.replace(/[​‌‍‎‏﻿­]/g, "")

  let matchStart = fullText.indexOf(searchText)

  // Fallback 1: strip invisible chars
  if (matchStart === -1) {
    const cleanFull = stripInvisible(fullText)
    const cleanSearch = stripInvisible(searchText)
    matchStart = cleanFull.indexOf(cleanSearch)
  }

  // Fallback 2: whitespace-collapsed match
  if (matchStart === -1) {
    const collapse = (s: string) => s.replace(/\s+/g, " ")
    const collapsedFull = collapse(fullText)
    const collapsedSearch = collapse(searchText)
    const collapsedIdx = collapsedFull.indexOf(collapsedSearch)
    if (collapsedIdx !== -1) {
      let ci = 0, oi = 0
      while (ci < collapsedIdx && oi < fullText.length) {
        if (/\s/.test(fullText[oi])) {
          while (oi < fullText.length && /\s/.test(fullText[oi])) oi++
          ci++
        } else { oi++; ci++ }
      }
      matchStart = oi
    }
  }

  // Fallback 3: Unicode normalization (handle ligatures like ﬁ → fi)
  if (matchStart === -1) {
    const normFull = norm(fullText)
    const normSearch = norm(searchText)
    const normIdx = normFull.indexOf(normSearch)
    if (normIdx !== -1) {
      // Map normalized index back, character by character
      let ni = 0, oi = 0
      while (ni < normIdx && oi < fullText.length) {
        const fc = norm(fullText[oi])
        if (fc.length === 0) { oi++; continue }
        ni += fc.length
        oi++
      }
      matchStart = oi
    }
  }

  if (matchStart === -1) {
    console.log("[findTextPositions] match failed",
      "search:", JSON.stringify(searchText.slice(0, 80)),
      "fullText head:", JSON.stringify(fullText.slice(0, 200)))
    return empty
  }

  const matchEnd = matchStart + searchText.length

  // Build a Range across the matching spans' text nodes for precise coords
  const range = document.createRange()
  const remainingStart = matchStart
  const remainingEnd = matchEnd

  // Find start text node
  let startTextNode: Text | null = null
  let startOffset = 0

  for (const entry of entries) {
    if (remainingStart >= entry.end) continue

    const localOffset = remainingStart - entry.start
    const walker = document.createTreeWalker(entry.el, NodeFilter.SHOW_TEXT)
    let textNode: Text | null
    let pos = 0
    while ((textNode = walker.nextNode() as Text | null)) {
      const len = textNode.textContent?.length || 0
      if (pos + len > localOffset) {
        startTextNode = textNode
        startOffset = localOffset - pos
        break
      }
      pos += len
    }
    if (startTextNode) break
  }

  // Find end text node
  let endTextNode: Text | null = null
  let endOffset = 0

  for (const entry of entries) {
    if (remainingEnd > entry.end) continue
    if (remainingEnd <= entry.start) break

    const localOffset = remainingEnd - entry.start
    const walker = document.createTreeWalker(entry.el, NodeFilter.SHOW_TEXT)
    let textNode: Text | null
    let pos = 0
    while ((textNode = walker.nextNode() as Text | null)) {
      const len = textNode.textContent?.length || 0
      if (pos + len >= localOffset) {
        endTextNode = textNode
        endOffset = localOffset - pos
        break
      }
      pos += len
    }
    if (endTextNode) break
  }

  if (!startTextNode || !endTextNode) return { rects: [], startOffset: matchStart, endOffset: matchEnd }

  try {
    range.setStart(startTextNode, startOffset)
    range.setEnd(endTextNode, endOffset)
  } catch (e) {
    console.log("[findTextPositions] Range.setStart/End failed", e)
    return { rects: [], startOffset: matchStart, endOffset: matchEnd }
  }

  const clientRects = range.getClientRects()
  const result: PositionRect[] = []
  for (let i = 0; i < clientRects.length; i++) {
    const r = clientRects[i]
    if (r.width > 0 && r.height > 0) {
      result.push({ x: r.left, y: r.top, width: r.width, height: r.height })
    }
  }
  return { rects: result, startOffset: matchStart, endOffset: matchEnd }
}

/**
 * Hook: match anchors to real-time text positions in the PDF text layer.
 * Re-matches when anchors or scale change (text layer re-renders on zoom).
 */
function useTextMatchPositions(
  layerRef: React.RefObject<HTMLDivElement | null>,
  anchors: TextAnchor[],
  pageNumber: number,
  scale: number,
): Map<string, PositionRect[]> {
  const [positions, setPositions] = useState<Map<string, PositionRect[]>>(new Map())
  const matchIdRef = useRef(0)
  const prevScaleRef = useRef(scale)
  const stableDimsRef = useRef("")

  useEffect(() => {
    const scaleChanged = prevScaleRef.current !== scale
    prevScaleRef.current = scale

    // On scale change, reset stability tracking so we wait for the text layer
    // to be re-rendered by react-pdf before matching
    if (scaleChanged) {
      stableDimsRef.current = ""
    }

    const matchId = ++matchIdRef.current
    let cancelled = false
    let attempts = 0
    const maxAttempts = 30

    function tryMatch() {
      if (cancelled) return

      const layer = layerRef.current
      if (!layer) return

      const textLayer = layer.querySelector(".react-pdf__Page__textContent") as HTMLElement | null
      if (!textLayer || !textLayer.querySelector('[role="presentation"]')) {
        if (attempts < maxAttempts) {
          attempts++
          requestAnimationFrame(tryMatch)
        } else {
          console.log("[useTextMatchPositions] page", pageNumber, "timed out waiting for text layer after", maxAttempts, "attempts")
        }
        return
      }

      // When scale changes, react-pdf may not have re-rendered the text layer yet.
      // Wait until the text layer dimensions stop changing (2 consecutive frames with same size),
      // signalling that the re-render at the new scale is complete.
      if (scaleChanged) {
        const rect = textLayer.getBoundingClientRect()
        const dims = `${rect.width.toFixed(1)}x${rect.height.toFixed(1)}`
        if (!stableDimsRef.current) {
          stableDimsRef.current = dims
          if (attempts < maxAttempts) {
            attempts++
            requestAnimationFrame(tryMatch)
            return
          }
        } else if (stableDimsRef.current !== dims) {
          stableDimsRef.current = dims
          if (attempts < maxAttempts) {
            attempts++
            requestAnimationFrame(tryMatch)
            return
          }
        }
      }

      if (attempts > 0) {
        console.log("[useTextMatchPositions] page", pageNumber, "text layer ready after", attempts, "attempts")
      }

      const layerRect = layer.getBoundingClientRect()
      const next = new Map<string, PositionRect[]>()
      let matched = 0
      let failed = 0

      for (const a of anchors) {
        if (a.pageNumber !== pageNumber) continue
        if (!a.text) continue

        const key = `${a.pageNumber}:${a.text}`
        if (next.has(key)) continue

        const result = findTextPositions(textLayer, a.text)
        if (result.rects.length > 0) {
          next.set(key, toLayerRelative(result.rects, layerRect))
          matched++
        } else {
          failed++
        }
      }

      if (matched > 0 || failed > 0) {
        console.log("[useTextMatchPositions] page", pageNumber, "matchId", matchId,
          "matched:", matched, "failed:", failed)
      }

      if (!cancelled) {
        setPositions(next)
      }
    }

    const timer = setTimeout(() => requestAnimationFrame(tryMatch), 100)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [anchors, pageNumber, scale, layerRef])

  return positions
}

export function AnnotationLayer({ pageNumber, anchors, scale, children, onCreateAnnotation, onCreateNote, onAskAI }: AnnotationLayerProps) {
  const [popup, setPopup] = useState<PopupMenuState | null>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const addToast = useToastStore((s) => s.addToast)

  const pageAnchors = anchors.filter((a) => a.pageNumber === pageNumber)
  const matchedPositions = useTextMatchPositions(layerRef, anchors, pageNumber, scale)

  const computeOffsets = useCallback((searchText: string): { startOffset: number; endOffset: number } => {
    const layer = layerRef.current
    if (!layer) return { startOffset: -1, endOffset: -1 }
    const textLayer = layer.querySelector(".react-pdf__Page__textContent") as HTMLElement | null
    if (!textLayer) return { startOffset: -1, endOffset: -1 }
    const result = findTextPositions(textLayer, searchText)
    return { startOffset: result.startOffset, endOffset: result.endOffset }
  }, [])

  const handleMouseUp = useCallback(() => {
    requestAnimationFrame(() => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setPopup(null)
        return
      }

      const range = sel.getRangeAt(0)
      if (!layerRef.current?.contains(range.commonAncestorContainer)) {
        return
      }

      const rects = getSelectionRects()
      if (rects.length === 0) return

      const searchText = sel.toString().trim()
      const offsets = computeOffsets(searchText)

      setPopup({
        x: rects[0].x + rects[0].width / 2,
        y: rects[0].y - 8,
        text: searchText,
        positions: rects,
        startOffset: offsets.startOffset,
        endOffset: offsets.endOffset,
      })
    })
  }, [computeOffsets])

  const showPopupAt = useCallback((clientX: number, clientY: number) => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.toString().trim()) return

    const range = sel.getRangeAt(0)
    if (!layerRef.current?.contains(range.commonAncestorContainer)) return

    const rects = getSelectionRects()
    if (rects.length === 0) return

    const searchText = sel.toString().trim()
    const offsets = computeOffsets(searchText)

    setPopup({
      x: clientX,
      y: clientY,
      text: searchText,
      positions: rects,
      startOffset: offsets.startOffset,
      endOffset: offsets.endOffset,
    })
  }, [computeOffsets])

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!layerRef.current?.contains(target)) return

      const sel = window.getSelection()
      if (sel && !sel.isCollapsed && sel.toString().trim() && layerRef.current?.contains(sel.getRangeAt(0).commonAncestorContainer)) {
        e.preventDefault()
        showPopupAt(e.clientX, e.clientY)
      }
    }

    document.addEventListener("mouseup", handleMouseUp)
    document.addEventListener("contextmenu", handleContextMenu)
    return () => {
      document.removeEventListener("mouseup", handleMouseUp)
      document.removeEventListener("contextmenu", handleContextMenu)
    }
  }, [handleMouseUp, showPopupAt])

  const handleCopy = useCallback(() => {
    if (!popup) return
    copyToClipboard(popup.text).then(() => {
      addToast({ message: "复制成功", type: "success" })
    })
    setPopup(null)
    window.getSelection()?.removeAllRanges()
  }, [popup, addToast])

  const handleCreateAnnotation = useCallback(() => {
    if (!popup || !onCreateAnnotation || !layerRef.current) return
    const layerRect = layerRef.current.getBoundingClientRect()
    const layerRects = toLayerRelative(popup.positions, layerRect)
    onCreateAnnotation(popup.text, boundingRect(layerRects), layerRects, pageNumber, popup.startOffset, popup.endOffset)
    setPopup(null)
    window.getSelection()?.removeAllRanges()
  }, [popup, onCreateAnnotation, pageNumber])

  const handleCreateNote = useCallback(() => {
    if (!popup || !onCreateNote || !layerRef.current) return
    const layerRect = layerRef.current.getBoundingClientRect()
    const layerRects = toLayerRelative(popup.positions, layerRect)
    onCreateNote(popup.text, boundingRect(layerRects), layerRects, pageNumber, popup.startOffset, popup.endOffset)
    setPopup(null)
    window.getSelection()?.removeAllRanges()
  }, [popup, onCreateNote, pageNumber])

  const handleAskAI = useCallback(() => {
    if (!popup || !onAskAI) return
    onAskAI(popup.text)
    setPopup(null)
    window.getSelection()?.removeAllRanges()
  }, [popup, onAskAI])

  // Merge anchors using real-time matched positions from the text layer
  const mergedAnchors = mergeAnchors(pageAnchors, matchedPositions)

  return (
    <div ref={layerRef} className="relative">
      {children}

      {/* Selection popup menu */}
      {popup && (
        <div
          className="fixed z-50 glass-surface-strong rounded-xl border border-[var(--border-color)] shadow-2xl py-1.5 min-w-[160px]"
          style={{
            left: popup.x,
            bottom: `calc(100vh - ${popup.y}px + 8px)`,
            transform: "translateX(-50%)",
          }}
        >
          <MenuItem icon={<MessageSquare className="size-4" />} label="创建批注" onClick={handleCreateAnnotation} />
          <MenuItem icon={<StickyNote className="size-4" />} label="创建笔记" onClick={handleCreateNote} />
          <MenuItem icon={<Bot className="size-4" />} label="询问AI" onClick={handleAskAI} />
          <div className="h-px bg-[var(--border-subtle)] my-1 mx-2" />
          <MenuItem icon={<Copy className="size-4" />} label="复制文本" onClick={handleCopy} />
        </div>
      )}

      {/* Underline markers — positioned by real-time text matching against the PDF text layer */}
      {mergedAnchors.map((m) => (
        <UnderlineMarker key={m.key} color={m.color} rects={m.rects} thin={m.noteOnly} />
      ))}
    </div>
  )
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors text-left"
    >
      <span className="text-[var(--text-tertiary)] shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  )
}

function UnderlineMarker({ color, rects, thin }: { color: string; rects: PositionRect[]; thin?: boolean }) {
  return (
    <>
      {rects.map((r, i) => (
        <div key={i} className="absolute pointer-events-none" style={{ left: r.x, top: r.y, width: r.width, height: r.height }}>
          {/* 半透明背景高亮 */}
          <div
            className="absolute inset-0"
            style={{ background: color, opacity: 0.15, borderRadius: 2 }}
          />
          {/* 下划线 — 笔记更细 */}
          <div
            className="absolute"
            style={{
              left: 0,
              bottom: -1,
              width: "100%",
              height: thin ? 1 : 2,
              background: color,
              borderRadius: 1,
              opacity: thin ? 0.45 : 0.55,
            }}
          />
        </div>
      ))}
    </>
  )
}

interface MergedAnchor {
  key: string
  color: string
  rects: PositionRect[]
  noteOnly: boolean
}

/**
 * Merge annotation + note anchors on the same text into a single underline.
 * Yellow = annotation only, Purple = note only, Blue = both.
 * Tries real-time text matching first, falls back to stored coordinates.
 */
function mergeAnchors(anchors: TextAnchor[], matchedPositions: Map<string, PositionRect[]>): MergedAnchor[] {
  const groups = new Map<string, { hasAnnotation: boolean; hasNote: boolean; fallbackRects: PositionRect[] }>()
  for (const a of anchors) {
    const key = `${a.pageNumber}:${a.text}`
    const storedRects = a.positions?.length ? a.positions : [a.position]
    const existing = groups.get(key)
    if (existing) {
      if (a.type === "annotation") existing.hasAnnotation = true
      if (a.type === "note") existing.hasNote = true
      if (!existing.fallbackRects.length) existing.fallbackRects = storedRects
    } else {
      groups.set(key, {
        hasAnnotation: a.type === "annotation",
        hasNote: a.type === "note",
        fallbackRects: storedRects,
      })
    }
  }
  return Array.from(groups.entries()).map(([key, g]) => ({
    key,
    color: g.hasAnnotation && g.hasNote ? "#60A5FA" : g.hasNote ? "#A78BFA" : "#FBBF24",
    // Use real-time matched positions, fall back to stored coordinates if text matching fails
    rects: matchedPositions.get(key) || g.fallbackRects,
    noteOnly: g.hasNote && !g.hasAnnotation,
  }))
}

/**
 * Build a map of text → underline color for the customTextRenderer.
 */
export function buildAnchorColorMap(anchors: TextAnchor[], pageNumber: number): Map<string, { annotation: boolean; note: boolean }> {
  const map = new Map<string, { annotation: boolean; note: boolean }>()
  for (const a of anchors) {
    if (a.pageNumber !== pageNumber || !a.text) continue
    const existing = map.get(a.text) || { annotation: false, note: false }
    if (a.type === "annotation") existing.annotation = true
    if (a.type === "note") existing.note = true
    map.set(a.text, existing)
  }
  return map
}

/**
 * Get the underline color for a given text based on what annotations/notes exist.
 * Note = purple #A78BFA, Annotation = yellow #FBBF24, Both = blue #60A5FA
 */
export function getAnchorColor(info: { annotation: boolean; note: boolean }): string {
  if (info.annotation && info.note) return "#60A5FA"
  if (info.note) return "#A78BFA"
  return "#FBBF24"
}
