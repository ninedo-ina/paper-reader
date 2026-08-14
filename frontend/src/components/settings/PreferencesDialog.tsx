"use client"

import { useState, useCallback } from "react"
import { X, Search, Monitor, Bot, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { AiConfigTab } from "@/components/settings/AiConfigTab"

type SettingsTab = "ui" | "ai"

interface TabConfig {
  key: SettingsTab
  label: string
  icon: React.ReactNode
}

const TABS: TabConfig[] = [
  { key: "ui", label: "UI 设置", icon: <Monitor className="size-4" /> },
  { key: "ai", label: "AI 配置", icon: <Bot className="size-4" /> },
]

interface PreferencesDialogProps {
  open: boolean
  onClose: () => void
}

export function PreferencesDialog({ open, onClose }: PreferencesDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("ui")
  const [search, setSearch] = useState("")

  const filteredTabs = TABS.filter((t) =>
    t.label.toLowerCase().includes(search.toLowerCase()),
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[800px] h-[560px] glass-surface-strong rounded-2xl border border-[var(--border-color)] shadow-2xl flex overflow-hidden">
        {/* Left menu */}
        <div className="w-[220px] border-r border-[var(--border-subtle)] flex flex-col shrink-0">
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[var(--text-tertiary)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索设置..."
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] pl-7.5 pr-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>
          </div>
          <nav className="flex-1 overflow-auto px-2 pb-2 flex flex-col gap-0.5">
            {filteredTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                  activeTab === tab.key
                    ? "bg-[var(--accent)]/10 text-[var(--accent)] font-medium"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]",
                )}
              >
                <span className="shrink-0">{tab.icon}</span>
                <span className="truncate">{tab.label}</span>
                <ChevronRight className="size-3.5 ml-auto shrink-0 opacity-40" />
              </button>
            ))}
            {filteredTabs.length === 0 && (
              <p className="text-xs text-[var(--text-tertiary)] text-center py-4">无匹配项</p>
            )}
          </nav>
        </div>

        {/* Right content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)]">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              {TABS.find((t) => t.key === activeTab)?.label}
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-[var(--bg-hover)] transition-colors"
            >
              <X className="size-4 text-[var(--text-tertiary)]" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-5">
            {activeTab === "ui" && <UiSettingsTab />}
            {activeTab === "ai" && <AiConfigTab />}
          </div>
        </div>
      </div>
    </div>
  )
}

function UiSettingsTab() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">语言 / Language</h3>
        <p className="text-xs text-[var(--text-tertiary)]">
          UI 语言设置（后续版本支持）
        </p>
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">字体大小</h3>
        <p className="text-xs text-[var(--text-tertiary)]">
          PDF 阅读器字体缩放等设置（后续版本支持）
        </p>
      </div>
    </div>
  )
}
