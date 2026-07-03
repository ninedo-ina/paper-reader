"use client"

import type { PaperListDto } from "@/lib/api/types"
import { formatDate, cn } from "@/lib/utils"
import { FileText, Globe, Trash2 } from "lucide-react"

interface PaperCardProps {
  paper: PaperListDto
  isActive?: boolean
  onClick?: () => void
  onDelete?: () => void
}

export function PaperCard({ paper, isActive, onClick, onDelete }: PaperCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left p-4 rounded-lg border transition-all duration-150",
        "hover:border-[var(--accent)] hover:shadow-sm",
        isActive
          ? "border-[var(--accent)] bg-[var(--surface-2)]"
          : "border-[var(--border-color)] bg-[var(--surface-0)]",
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
          <h4 className="text-sm font-medium text-[var(--text-primary)] truncate">
            {paper.title || "Untitled"}
          </h4>
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
          <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
            {formatDate(paper.createdAt)}
          </p>
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
