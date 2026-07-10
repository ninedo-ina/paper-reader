"use client"

import { useState, useEffect, type ElementType } from "react"
import { useTranslations } from "next-intl"
import { Library, Clock, FileText, Settings, Star, Tag, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { usePaperStore } from "@/stores/paper-store"

const sections = [
  {
    label: "Library",
    items: [
      { key: "library", icon: Library, dynamicBadge: true },
      { key: "history", icon: Clock, badge: "12" },
      { key: "notes", icon: FileText, badge: "8" },
    ],
  },
  {
    label: "Discover",
    items: [
      { key: "starred", icon: Star, badge: "0" },
      { key: "tags", icon: Tag, badge: "0" },
    ],
  },
]

const bottomItems = [
  { key: "settings", icon: Settings, badge: null },
]

interface SidebarProps {
  activePanel?: string | null
  onNavigate?: (key: string) => void
}

interface SidebarItem {
  key: string
  icon: ElementType
  badge?: string | null
  dynamicBadge?: boolean
}

export function Sidebar({ activePanel, onNavigate }: SidebarProps) {
  const t = useTranslations("nav")
  const [collapsed, setCollapsed] = useState(false)
  const { total, loadPapers } = usePaperStore()

  useEffect(() => {
    loadPapers(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const papersBadge = total > 99 ? "99+" : String(total)

  const renderCollapsedItem = (item: SidebarItem) => (
    <button
      key={item.key}
      onClick={() => onNavigate?.(item.key)}
      title={t(item.key)}
      className={cn(
        "flex items-center justify-center w-9 h-9 mx-auto mb-0.5 rounded-[10px] transition-all duration-150",
        "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
        activePanel === item.key &&
          "bg-[var(--bg-active)] text-[var(--text-primary)]",
      )}
    >
      <item.icon className="w-[18px] h-[18px]" />
    </button>
  )

  const renderExpandedItem = (item: SidebarItem) => {
    const badge = item.dynamicBadge ? papersBadge : item.badge

    return (
      <button
        key={item.key}
        onClick={() => onNavigate?.(item.key)}
        className={cn(
          "flex items-center gap-2.5 px-3 py-2 mx-1 mb-0.5 rounded-[10px] text-[13.5px] font-[470] transition-all duration-150",
          "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
          activePanel === item.key &&
            "bg-[var(--bg-active)] text-[var(--text-primary)] font-[550]",
        )}
      >
        <item.icon className="w-[18px] h-[18px] shrink-0" />
        <span className="flex-1 text-left">{t(item.key)}</span>
        {badge && (
          <span className="ml-auto bg-[var(--accent-soft)] text-[var(--text-secondary)] text-[11px] font-semibold px-[7px] py-[2px] rounded-[10px]">
            {badge}
          </span>
        )}
      </button>
    )
  }

  return (
    <aside
      className={cn(
        "border-r border-[var(--border-subtle)] flex flex-col py-3 select-none shrink-0 transition-all duration-200",
        collapsed ? "w-[52px]" : "w-[220px]",
      )}
      style={{ background: "var(--surface-1)", backdropFilter: "blur(20px) saturate(180%)" }}
    >
      {/* Header */}
      {collapsed ? (
        <div className="flex justify-center mb-1">
          <button
            onClick={() => setCollapsed(false)}
            title="Expand sidebar"
            className="p-1 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all"
          >
            <PanelLeftOpen className="w-[15px] h-[15px]" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between px-3 mb-4">
          <div className="flex flex-col gap-1.5 text-center flex-1">
            <span className="font-[680] text-[14px] tracking-[-0.3px] text-[var(--text-primary)]">
              PaperReader
            </span>
            <span className="text-[11px] text-[var(--text-tertiary)]">
              More Interest Less Interests
            </span>
          </div>
          <button
            onClick={() => setCollapsed(true)}
            title="Collapse sidebar"
            className="p-1 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all shrink-0"
          >
            <PanelLeftClose className="w-[15px] h-[15px]" />
          </button>
        </div>
      )}

      {collapsed ? (
        <>
          {sections.map((section) => (
            <div key={section.label} className="flex flex-col items-center gap-1 mt-3">
              {section.items.map(renderCollapsedItem)}
            </div>
          ))}
          <div className="flex-1" />
          <div className="flex flex-col items-center gap-1">
            {bottomItems.map(renderCollapsedItem)}
          </div>
        </>
      ) : (
        <>
          {sections.map((section) => (
            <div key={section.label}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.6px] text-[var(--text-tertiary)] px-3 pt-4 pb-1.5">
                {section.label}
              </div>
              {section.items.map(renderExpandedItem)}
            </div>
          ))}

          <div className="flex-1" />

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.6px] text-[var(--text-tertiary)] px-3 pt-4 pb-1.5">
              Settings
            </div>
            {bottomItems.map(renderExpandedItem)}
          </div>
        </>
      )}
    </aside>
  )
}
