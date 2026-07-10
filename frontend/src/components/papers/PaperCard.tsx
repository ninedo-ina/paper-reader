"use client"

import type { PaperListDto } from "@/lib/api/types"
import { getCategory } from "@/lib/paper-categories"
import { formatDate, cn } from "@/lib/utils"
import { FileText, Globe, Trash2, ExternalLink } from "lucide-react"
import { useRouter } from "next/navigation"

interface PaperCardProps {
  paper: PaperListDto
  isActive?: boolean
  onClick?: () => void
  onDelete?: () => void
}

export function PaperCard({ paper, isActive, onClick, onDelete }: PaperCardProps) {
  const router = useRouter()
  const catDef = getCategory(paper.category)

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-[10px] border transition-all duration-150",
        "hover:bg-[var(--bg-hover)] hover:shadow-[var(--shadow-sm)]",
        isActive
          ? "border-[var(--accent)] bg-[var(--bg-active)]"
          : "border-[var(--border-subtle)] bg-[var(--surface-2)]",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {paper.sourceType === "URL" ? (
            <Globe className="size-4 text-[var(--text-tertiary)]" />
          ) : (
            <FileText className="size-4 text-[var(--text-tertiary)]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h4 className="text-sm font-medium text-[var(--text-primary)] truncate flex-1">
              {paper.title || "Untitled"}
            </h4>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                router.push(`/papers/${paper.id}`)
              }}
              className="shrink-0 p-0.5 rounded text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
              aria-label="View details"
            >
              <ExternalLink className="size-3.5" />
            </button>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
            {paper.authors || "Unknown authors"}
          </p>
          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-[var(--text-tertiary)]">
            {paper.year && <span>{paper.year}</span>}
            {paper.journal && <span className="truncate">{paper.journal}</span>}
            {paper.pageCount && (
              <span>
                {paper.pageCount}
                &thinsp;p
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
              {catDef?.label ?? paper.category}
            </span>
            <p className="text-[10px] text-[var(--text-tertiary)]">
              {formatDate(paper.createdAt)}
            </p>
          </div>
        </div>
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="shrink-0 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--text-tertiary)] hover:text-red-500 transition-colors"
            aria-label="Delete"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </button>
  )
}
