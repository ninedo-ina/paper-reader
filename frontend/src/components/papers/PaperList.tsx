"use client"

import { useEffect, useCallback } from "react"
import { useTranslations } from "next-intl"
import { usePaperStore } from "@/stores/paper-store"
import { PaperCard } from "./PaperCard"
import { Button } from "@/components/ui/Button"
import { ChevronLeft, ChevronRight, Plus, Upload, RefreshCw, X } from "lucide-react"

interface PaperListProps {
  activeId?: number | null
  onSelect?: (id: number) => void
  onUpload?: () => void
  onCreate?: () => void
  onClose?: () => void
}

export function PaperList({ activeId, onSelect, onUpload, onCreate, onClose }: PaperListProps) {
  const t = useTranslations("common")
  const { papers, total, page, isListLoading, loadPapers, deletePaper } = usePaperStore()
  const pageSize = 20
  const totalPages = Math.ceil(total / pageSize)

  useEffect(() => {
    loadPapers(1)
  }, [loadPapers])

  const handleRefresh = useCallback(() => {
    loadPapers(page)
  }, [loadPapers, page])

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            {t("myPapers") || "我的论文"}
          </h2>
          <div className="flex items-center gap-0.5">
            <button onClick={onCreate} title="创建论文"
              className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all">
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button onClick={onUpload} title="导入论文"
              className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all">
              <Upload className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleRefresh} title="刷新"
              className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            {onClose && (
              <button onClick={onClose} title="关闭"
                className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
          {total} 篇论文
        </p>
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
