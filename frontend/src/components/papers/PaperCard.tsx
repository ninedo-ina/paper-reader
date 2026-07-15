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
import { FileText, Globe, MoreHorizontal, Star, Tag, Share2, Download } from "lucide-react"

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
  ]

  return (
    <div
      className={cn(
        "group relative rounded-xl border transition-all duration-200 cursor-pointer",
        "hover:shadow-[var(--shadow-md)] hover:bg-[var(--surface-1)]/70 hover:backdrop-blur-sm",
        isActive
          ? "border-[var(--accent)] bg-[var(--bg-active)] shadow-[var(--shadow-sm)]"
          : "border-[var(--border-subtle)] bg-[var(--surface-2)]",
      )}
      onClick={onClick}
    >
      {/* Accent color strip */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
        style={{ background: isActive ? "var(--accent)" : accentColor }}
      />

      <div className="flex items-start gap-3 pl-[11px] pr-3 py-3.5">
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
          <div className="flex items-center justify-between mt-1.5">
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
              {paper.year && <span>{paper.year}</span>}
              {paper.year && paper.journal && <span>&middot;</span>}
              {paper.journal && <span className="truncate max-w-[100px]">{paper.journal}</span>}
              {paper.journal && paper.pageCount && <span>&middot;</span>}
              {paper.pageCount && <span>{paper.pageCount}p</span>}
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
              style={{ background: `${accentColor}15`, color: accentColor }}
            >
              {catDef?.label ?? paper.category}
            </span>
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

      {/* Three-dot menu button — bottom-right corner */}
      <button
        ref={menuRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setMenuOpen((prev) => !prev)
        }}
        className="absolute bottom-1.5 right-1.5 p-1 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors opacity-0 group-hover:opacity-100"
        aria-label="More"
      >
        <MoreHorizontal className="size-4" />
      </button>

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
