"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import type { PaperDetailDto } from "@/lib/api/types"

type PanelTab = "metadata" | "annotations" | "notes" | "aiChat"

interface RightPanelProps {
  paper?: PaperDetailDto | null
}

export function RightPanel({ paper }: RightPanelProps) {
  const t = useTranslations("panel")
  const [activeTab, setActiveTab] = useState<PanelTab>("metadata")

  const tabs: { key: PanelTab; label: string }[] = [
    { key: "metadata", label: t("metadata") },
    { key: "annotations", label: t("annotations") },
    { key: "notes", label: t("notes") },
    { key: "aiChat", label: t("aiChat") },
  ]

  return (
    <aside className="w-[380px] border-l border-[var(--border-subtle)] flex flex-col select-none shrink-0"
      style={{ background: "var(--surface-1)", backdropFilter: "blur(20px) saturate(180%)" }}>
      <nav className="flex border-b border-[var(--border-subtle)] px-2 pt-1.5 gap-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2.5 text-[12.5px] font-[540] rounded-t-lg border-b-2 border-transparent transition-all duration-150 -mb-px",
              "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
              activeTab === tab.key &&
                "text-[var(--text-primary)] border-[var(--text-primary)]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-auto p-4">
        {activeTab === "metadata" && <MetadataContent paper={paper} />}
        {activeTab === "annotations" && (
          <EmptyState message="No annotations yet" />
        )}
        {activeTab === "notes" && <EmptyState message="No notes yet" />}
        {activeTab === "aiChat" && (
          <EmptyState message="Start an AI conversation" />
        )}
      </div>
    </aside>
  )
}

function MetadataContent({ paper }: { paper?: PaperDetailDto | null }) {
  const t = useTranslations("metadata")

  if (!paper) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-[var(--text-tertiary)]">Select a paper</p>
      </div>
    )
  }

  const rows = [
    { label: t("authors"), value: paper.authors },
    { label: t("year"), value: paper.year },
    { label: t("journal"), value: paper.journal },
    { label: t("doi"), value: paper.doi, mono: true },
  ].filter((r) => r.value)

  return (
    <div className="space-y-2.5">
      <div className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface-2)] shadow-[var(--shadow-sm)] p-4">
        <h3 className="text-[11px] font-[650] text-[var(--text-tertiary)] uppercase tracking-[0.6px] mb-2.5">
          Paper Metadata
        </h3>
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between items-start py-1.5 border-b border-[var(--border-subtle)] last:border-0 text-[13px]">
            <span className="text-[12px] text-[var(--text-tertiary)] min-w-[60px]">{row.label}</span>
            <span className={row.mono ? "font-mono text-[11px] text-[var(--text-primary)] text-right" : "text-[var(--text-primary)] text-right font-[470]"}>
              {String(row.value)}
            </span>
          </div>
        ))}
      </div>

      {paper.abstractText && (
        <div className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface-2)] shadow-[var(--shadow-sm)] p-4">
          <h3 className="text-[11px] font-[650] text-[var(--text-tertiary)] uppercase tracking-[0.6px] mb-2">
            Abstract
          </h3>
          <p className="text-[12.5px] text-[var(--text-secondary)] leading-[1.65]">
            {paper.abstractText}
          </p>
        </div>
      )}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <span className="text-sm text-[var(--text-tertiary)]">{message}</span>
    </div>
  )
}
