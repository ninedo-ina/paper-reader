"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslations } from "next-intl"
import { usePaperStore } from "@/stores/paper-store"
import { PaperCard } from "./PaperCard"
import { TabBar } from "@/components/ui/TabBar"
import { TagDialog } from "./TagDialog"
import { ShareDialog } from "./ShareDialog"
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
  const tp = useTranslations("papers")
  const {
    papers, total, page, isListLoading, activeTab, loadPapers,
    setActiveTab, deletePaper,
  } = usePaperStore()
  const pageSize = 20
  const totalPages = Math.ceil(total / pageSize)

  const [tagPaperId, setTagPaperId] = useState<number | null>(null)
  const [sharePaperId, setSharePaperId] = useState<number | null>(null)

  useEffect(() => {
    loadPapers(0)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = useCallback(() => { loadPapers(page) }, [loadPapers, page])

  const createCount = papers.filter((p) => p.sourceType === "MANUAL").length
  const importCount = papers.filter((p) => p.sourceType === "UPLOAD" || p.sourceType === "URL").length

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
      </div>

      {/* TabBar */}
      <TabBar
        tabs={[
          { key: "create", label: tp("createTab"), count: createCount },
          { key: "import", label: tp("importTab"), count: importCount },
        ]}
        activeKey={activeTab}
        onChange={(key) => { setActiveTab(key as "create" | "import"); key === "create" ? onCreate?.() : onUpload?.() }}
      />

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
              onTag={() => setTagPaperId(paper.id)}
              onShare={() => setSharePaperId(paper.id)}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--border-color)]">
          <Button
            variant="ghost"
            size="sm"
            disabled={page <= 0}
            onClick={() => loadPapers(page - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-xs text-[var(--text-tertiary)]">
            {page + 1}/{totalPages}
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

      <TagDialog open={tagPaperId !== null} paperId={tagPaperId} onClose={() => setTagPaperId(null)} />
      <ShareDialog open={sharePaperId !== null} paperId={sharePaperId} onClose={() => setSharePaperId(null)} />
    </div>
  )
}
