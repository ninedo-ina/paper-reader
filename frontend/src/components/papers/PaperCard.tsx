"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { createPortal } from "react-dom"
import { useTranslations } from "next-intl"
import type { PaperListDto } from "@/lib/api/types"
import { getCategory } from "@/lib/paper-categories"
import { cn } from "@/lib/utils"
import { usePaperStore } from "@/stores/paper-store"
import { downloadPdf } from "@/lib/api/papers"
import type { DropdownItem } from "@/components/ui/DropdownMenu"
import { FileText, Globe, MoreHorizontal, Star, Tag, Share2, Download, Trash2 } from "lucide-react"

const categoryAccent: Record<string, string> = {
  THESIS: "#a78bfa",
  JOURNAL: "#60a5fa",
  PREPRINT: "#34d399",
  COURSE: "#fbbf24",
  TECH_REPORT: "#f472b6",
  PATENT: "#fb923c",
}

interface PaperCardProps {
  paper: PaperListDto
  isActive?: boolean
  onClick?: () => void
  onDelete?: () => void
  onTag?: () => void
  onShare?: () => void
}

export function PaperCard({ paper, isActive, onClick, onDelete, onTag, onShare }: PaperCardProps) {
  const t = useTranslations("papers")
  const menuRef = useRef<HTMLButtonElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const { toggleFavorite } = usePaperStore()
  const catDef = getCategory(paper.category)

  const handleToggleFavorite = useCallback(() => {
    toggleFavorite(paper.id)
  }, [toggleFavorite, paper.id])

  const handleDownload = useCallback(() => {
    const filename = `${paper.title || "paper"}.pdf`
    downloadPdf(paper.id, filename)
  }, [paper.id, paper.title])

  const firstAuthor = paper.authors?.split(",")[0]?.trim() || "Unknown"
  const accentColor = categoryAccent[paper.category] || "var(--accent)"

  const menuItems: DropdownItem[] = [
    { label: paper.favorite ? t("unfavorite") : t("favorite"), icon: <Star className="size-3.5" />, onClick: handleToggleFavorite },
    { label: t("tags"), icon: <Tag className="size-3.5" />, onClick: () => onTag?.() },
    { label: t("share"), icon: <Share2 className="size-3.5" />, onClick: () => onShare?.() },
    { label: t("download"), icon: <Download className="size-3.5" />, onClick: handleDownload },
    { label: t("delete"), icon: <Trash2 className="size-3.5" />, onClick: () => onDelete?.(), danger: true },
  ]

  return (
    <div
      className={cn(
        "group relative rounded-xl border transition-all duration-200 cursor-pointer",
        isActive
          ? "border-[var(--paper-active-border)] bg-[var(--paper-active-bg)] shadow-[var(--paper-active-shadow)] hover:bg-[var(--paper-active-bg-hover)] hover:shadow-[var(--paper-active-shadow-hover)]"
          : "border-[var(--border-subtle)] bg-[var(--surface-2)] hover:bg-[var(--surface-1)]/70 hover:shadow-[var(--shadow-md)] hover:backdrop-blur-sm",
      )}
      onClick={onClick}
      data-active={isActive ? "true" : "false"}
      aria-current={isActive ? "page" : undefined}
    >
      {/* Inset capsule keeps the state visible without a heavy full-height edge. */}
      <div
        aria-hidden="true"
        data-testid="paper-card-indicator"
        className="pointer-events-none absolute left-[5px] top-3 bottom-3 w-0.5 rounded-full transition-[background-color,opacity] duration-200"
        style={{
          background: isActive ? "var(--paper-active-indicator)" : accentColor,
          opacity: isActive ? 1 : 0.72,
        }}
      />

      <div className="flex items-start gap-3 py-3.5 pl-3.5 pr-3">
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2">
            <span className="shrink-0">
              {paper.sourceType === "URL" ? (
                <Globe className="size-3.5 text-[var(--text-tertiary)]" />
              ) : (
                <FileText className="size-3.5 text-[var(--text-tertiary)]" />
              )}
            </span>
            <h4 className="text-[14px] font-semibold text-[var(--text-primary)] truncate leading-snug">
              {paper.title || "Untitled"}
            </h4>
            {paper.favorite && (
              <Star className="size-3 shrink-0 text-amber-400 fill-amber-400" />
            )}
          </div>

          {/* Author */}
          <p className="text-[12px] text-[var(--text-secondary)] mt-1 truncate">
            {firstAuthor}
          </p>

          {/* Metadata row */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto_28px] items-center gap-2 mt-1.5">
            <div className="min-w-0 flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)] overflow-hidden">
              {paper.year && <span>{paper.year}</span>}
              {paper.year && paper.journal && <span>&middot;</span>}
              {paper.journal && <span className="truncate">{paper.journal}</span>}
              {paper.journal && paper.pageCount && <span>&middot;</span>}
              {paper.pageCount && <span className="shrink-0">{paper.pageCount}p</span>}
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
              style={{ background: `${accentColor}15`, color: accentColor }}
            >
              {catDef?.label ?? paper.category}
            </span>
            <button
              ref={menuRef}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setMenuOpen((previous) => !previous)
              }}
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-[var(--text-tertiary)] opacity-60 transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] hover:opacity-100 focus-visible:opacity-100"
              aria-label={t("moreActions")}
              aria-expanded={menuOpen}
            >
              <MoreHorizontal className="size-4" />
            </button>
          </div>

          {/* Tags */}
          {paper.tags && paper.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {paper.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--surface-1)] text-[var(--text-secondary)] border border-[var(--border-subtle)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Portal dropdown menu */}
      {menuOpen &&
        createPortal(
          <DropdownPortal
            items={menuItems}
            triggerRef={menuRef}
            onClose={() => setMenuOpen(false)}
          />,
          document.body,
        )}
    </div>
  )
}

function DropdownPortal({
  items,
  triggerRef,
  onClose,
}: {
  items: DropdownItem[]
  triggerRef: React.RefObject<HTMLButtonElement | null>
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    const btn = triggerRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    setPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 160) })
  }, [triggerRef])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target)) return
      if (triggerRef.current?.contains(target)) return
      onClose()
    }
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", handler)
    document.addEventListener("keydown", keyHandler)
    return () => {
      document.removeEventListener("mousedown", handler)
      document.removeEventListener("keydown", keyHandler)
    }
  }, [onClose, triggerRef])

  if (!pos) return null

  return (
    <div
      ref={menuRef}
      style={{ top: pos.top, left: pos.left }}
      className="fixed z-50 min-w-[140px] py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-0)] shadow-lg"
    >
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            item.onClick()
            onClose()
          }}
          className={cn(
            "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors",
            item.danger
              ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              : "text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
          )}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  )
}
