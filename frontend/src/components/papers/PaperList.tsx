"use client"

import { useEffect } from "react"
import { useTranslations } from "next-intl"
import { usePaperStore } from "@/stores/paper-store"
import { PaperCard } from "./PaperCard"
import { Button } from "@/components/ui/Button"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface PaperListProps {
  activeId?: number | null
  onSelect?: (id: number) => void
}

export function PaperList({ activeId, onSelect }: PaperListProps) {
  const t = useTranslations("common")
  const { papers, total, page, isListLoading, loadPapers, deletePaper } = usePaperStore()
  const pageSize = 20
  const totalPages = Math.ceil(total / pageSize)

  useEffect(() => {
    loadPapers(1)
  }, [loadPapers])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          {t("myPapers") || "My Papers"}
        </h2>
        <span className="text-xs text-[var(--text-tertiary)]">
          {total} {t("papers") || "papers"}
        </span>
      </div>

      {isListLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-[var(--text-tertiary)]">{t("loading")}</p>
        </div>
      ) : papers.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-[var(--text-tertiary)] text-center">
            {t("noData")}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {papers.map((paper) => (
            <PaperCard
              key={paper.id}
              paper={paper}
              isActive={paper.id === activeId}
              onClick={() => onSelect?.(paper.id)}
              onDelete={() => deletePaper(paper.id)}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--border-color)]">
          <Button
            variant="ghost"
            size="sm"
            disabled={page <= 1}
            onClick={() => loadPapers(page - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-xs text-[var(--text-tertiary)]">
            {page}/{totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => loadPapers(page + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
