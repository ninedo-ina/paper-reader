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
    <aside className="w-95 border-l border-[var(--border-color)] glass-surface flex flex-col select-none shrink-0">
      <nav className="flex border-b border-[var(--border-color)] h-10">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex-1 text-xs font-medium transition-all duration-150",
              "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
              activeTab === tab.key &&
                "text-[var(--text-primary)] shadow-[inset_0_-2px_0_var(--accent)]",
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
        <span className="text-sm text-[var(--text-tertiary)]">Select a paper</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[var(--text-primary)] leading-snug">
        {paper.title || "Untitled"}
      </h2>
      <div className="space-y-2 text-sm">
        {paper.authors && (
          <div>
            <span className="text-[var(--text-tertiary)]">{t("authors")}: </span>
            <span className="text-[var(--text-secondary)]">{paper.authors}</span>
          </div>
        )}
        {paper.year && (
          <div>
            <span className="text-[var(--text-tertiary)]">{t("year")}: </span>
            <span className="text-[var(--text-secondary)]">{paper.year}</span>
          </div>
        )}
        {paper.journal && (
          <div>
            <span className="text-[var(--text-tertiary)]">{t("journal")}: </span>
            <span className="text-[var(--text-secondary)]">{paper.journal}</span>
          </div>
        )}
        {paper.doi && (
          <div>
            <span className="text-[var(--text-tertiary)]">{t("doi")}: </span>
            <span className="text-[var(--text-secondary)] text-xs break-all">{paper.doi}</span>
          </div>
        )}
      </div>
      {paper.abstractText && (
        <div>
          <h3 className="text-xs font-medium text-[var(--text-tertiary)] mb-1">
            {t("abstract")}
          </h3>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
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
