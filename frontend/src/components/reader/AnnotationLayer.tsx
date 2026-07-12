"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { MessageSquare, StickyNote, Bot, Copy, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToastStore } from "@/stores/toast-store"

export type AnchorType = "annotation" | "note"

export interface TextAnchor {
  id: number
  type: AnchorType
  text: string
  pageNumber: number
  position: { x: number; y: number; width: number; height: number }
}

interface AnnotationLayerProps {
  pageNumber: number
  anchors: TextAnchor[]
  onCreateAnnotation?: (text: string, position: { x: number; y: number; width: number; height: number }) => void
  onCreateNote?: (text: string, position: { x: number; y: number; width: number; height: number }) => void
  onAskAI?: (text: string) => void
}

interface PopupMenuState {
  x: number
  y: number
  text: string
  position: { x: number; y: number; width: number; height: number }
}

export function AnnotationLayer({ pageNumber, anchors, onCreateAnnotation, onCreateNote, onAskAI }: AnnotationLayerProps) {
  const [popup, setPopup] = useState<PopupMenuState | null>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const addToast = useToastStore((s) => s.addToast)

  const pageAnchors = anchors.filter((a) => a.pageNumber === pageNumber)

  useEffect(() => {
    const handleSelection = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setPopup(null)
        return
      }

      const text = sel.toString().trim()
      if (!text) {
        setPopup(null)
        return
      }

      // Check if selection is within our layer
      const range = sel.getRangeAt(0)
      if (!layerRef.current?.contains(range.commonAncestorContainer)) {
        setPopup(null)
        return
      }

      const rect = range.getBoundingClientRect()
      setPopup({
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
        text,
        position: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      })
    }

    document.addEventListener("selectionchange", handleSelection)
    return () => document.removeEventListener("selectionchange", handleSelection)
  }, [])

  const handleCopy = useCallback(() => {
    if (!popup) return
    navigator.clipboard.writeText(popup.text).then(() => {
      addToast({ message: "复制成功", type: "success" })
    })
    setPopup(null)
    window.getSelection()?.removeAllRanges()
  }, [popup, addToast])

  const handleCreateAnnotation = useCallback(() => {
    if (!popup || !onCreateAnnotation) return
    onCreateAnnotation(popup.text, popup.position)
    setPopup(null)
    window.getSelection()?.removeAllRanges()
  }, [popup, onCreateAnnotation])

  const handleCreateNote = useCallback(() => {
    if (!popup || !onCreateNote) return
    onCreateNote(popup.text, popup.position)
    setPopup(null)
    window.getSelection()?.removeAllRanges()
  }, [popup, onCreateNote])

  const handleAskAI = useCallback(() => {
    if (!popup || !onAskAI) return
    onAskAI(popup.text)
    setPopup(null)
    window.getSelection()?.removeAllRanges()
  }, [popup, onAskAI])

  return (
    <div ref={layerRef} className="relative">
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

      {/* Underline markers for existing anchors */}
      {pageAnchors.map((anchor) => (
        <UnderlineMarker key={`${anchor.type}-${anchor.id}`} anchor={anchor} layerRef={layerRef} />
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

function UnderlineMarker({ anchor, layerRef }: { anchor: TextAnchor; layerRef: React.RefObject<HTMLDivElement | null> }) {
  if (!layerRef.current) return null

  // Determine color based on type
  // annotation (批注) = yellow, note (笔记) = purple, both = blue
  // Since each anchor is a single type at DB level, we derive the color
  const color = anchor.type === "note" ? "#A78BFA" : "#FBBF24"

  // Convert page-relative coordinates from the stored position
  // The position is stored relative to the viewport, so we compute offset relative to the layer
  const layerRect = layerRef.current.getBoundingClientRect()

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: anchor.position.x - layerRect.left,
        top: anchor.position.y - layerRect.top + anchor.position.height,
        width: anchor.position.width,
        height: 3,
        background: color,
        borderRadius: 2,
        opacity: 0.7,
      }}
    />
  )
}

/**
 * Build a map of text → underline color for the customTextRenderer.
 * Returns both a Map<string, string> for easy lookup and a set of text patterns.
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
 * Note (笔记) = purple #A78BFA, Annotation (批注) = yellow #FBBF24, Both = blue #60A5FA
 */
export function getAnchorColor(info: { annotation: boolean; note: boolean }): string {
  if (info.annotation && info.note) return "#60A5FA" // blue for both
  if (info.note) return "#A78BFA" // purple for note
  return "#FBBF24" // yellow for annotation/批注
}
