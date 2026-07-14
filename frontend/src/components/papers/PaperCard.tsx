"use client"

import { useRef, useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import type { PaperListDto } from "@/lib/api/types"
import { getCategory } from "@/lib/paper-categories"
import { formatDate, cn } from "@/lib/utils"
import { usePaperStore } from "@/stores/paper-store"
import { downloadPdf } from "@/lib/api/papers"
import { DropdownMenu, type DropdownItem } from "@/components/ui/DropdownMenu"
import { FileText, Globe, MoreHorizontal, Star, Tag, Share2, Download } from "lucide-react"

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

  const menuItems: DropdownItem[] = [
    { label: paper.favorite ? t("unfavorite") : t("favorite"), icon: <Star className="size-3.5" />, onClick: handleToggleFavorite },
    { label: t("tags"), icon: <Tag className="size-3.5" />, onClick: () => onTag?.() },
    { label: t("share"), icon: <Share2 className="size-3.5" />, onClick: () => onShare?.() },
    { label: t("download"), icon: <Download className="size-3.5" />, onClick: handleDownload },
  ]

  return (
    <div
      className={cn(
        "relative rounded-lg border transition-all duration-150 cursor-pointer",
        "hover:shadow-[var(--shadow-sm)]",
        isActive
          ? "border-[var(--accent)] bg-[var(--bg-active)]"
          : "border-[var(--border-subtle)] bg-[var(--surface-2)] hover:bg-[var(--bg-hover)]",
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2 p-2.5">
        {/* Icon + Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="shrink-0">
              {paper.sourceType === "URL" ? (
                <Globe className="size-3 text-[var(--text-tertiary)]" />
              ) : (
                <FileText className="size-3 text-[var(--text-tertiary)]" />
              )}
            </span>
            <h4 className="text-[13px] font-medium text-[var(--text-primary)] truncate leading-tight">
              {paper.title || "Untitled"}
            </h4>
            {paper.favorite && (
              <Star className="size-3 shrink-0 text-amber-400 fill-amber-400" />
            )}
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 truncate">
            {firstAuthor}
          </p>
          <div className="flex items-center gap-1.5 mt-1 text-[10px] text-[var(--text-tertiary)]">
            {paper.year && <span>{paper.year}</span>}
            {paper.journal && <span className="truncate max-w-[120px]">{paper.journal}</span>}
            {paper.pageCount && <span>{paper.pageCount}p</span>}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
              {catDef?.label ?? paper.category}
            </span>
            <span className="text-[10px] text-[var(--text-tertiary)]">
              {formatDate(paper.createdAt)}
            </span>
          </div>
          {paper.tags && paper.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {paper.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--surface-1)] text-[var(--text-secondary)] border border-[var(--border-subtle)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Three-dot menu button */}
        <button
          ref={menuRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen((prev) => !prev)
          }}
          className="shrink-0 p-1 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          aria-label="More"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </div>

      <DropdownMenu items={menuItems} open={menuOpen} onClose={() => setMenuOpen(false)} triggerRef={menuRef} />
    </div>
  )
}
