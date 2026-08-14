"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslations } from "next-intl"
import { Clock, BookOpen, X } from "lucide-react"
import { getRecent } from "@/lib/api/reading-logs"
import { cn } from "@/lib/utils"
import type { ReadingLogDto } from "@/lib/api/types"

interface HistoryPanelProps {
  onSelect?: (paperId: number) => void
  onClose?: () => void
}

const DISPLAY_LIMIT = 50

export function HistoryPanel({ onSelect, onClose }: HistoryPanelProps) {
  const t = useTranslations()
  const [logs, setLogs] = useState<ReadingLogDto[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getRecent(DISPLAY_LIMIT)
      setLogs(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            {t("nav.history")}
          </h2>
          {onClose && (
            <button onClick={onClose}
              className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
          {t("reader.readingSessions") || "Recent reading sessions"}
        </p>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-[var(--text-tertiary)]">{t("common.loading")}</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-[var(--text-tertiary)] text-center">
            {t("common.noData")}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {logs.map((log) => (
            <button
              key={log.id}
              type="button"
              onClick={() => onSelect?.(log.paperId)}
              className={cn(
                "w-full text-left p-3 rounded-xl transition-all hover:bg-[var(--surface-2)]",
              )}
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5 p-1.5 rounded-lg bg-[var(--surface-2)]">
                  <BookOpen className="size-3.5 text-[var(--text-secondary)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-[470] text-[var(--text-primary)] truncate">
                    {log.paperTitle || `Paper #${log.paperId}`}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-[var(--text-tertiary)]">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" />
                      {new Date(log.createdAt).toLocaleDateString()}
                    </span>
                    {log.durationSeconds ? (
                      <span>
                        {Math.round(log.durationSeconds / 60)} min
                      </span>
                    ) : null}
                    <span>
                      p.{log.currentPage}/{log.totalPages}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
