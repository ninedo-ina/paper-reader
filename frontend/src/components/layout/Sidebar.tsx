"use client"

import type { ElementType } from "react"
import { useTranslations } from "next-intl"
import { Library, Upload, Clock, FileText, Settings, Star, Tag } from "lucide-react"
import { cn } from "@/lib/utils"

const sections = [
  {
    label: "Library",
    items: [
      { key: "library", icon: Library, badge: null },
      { key: "history", icon: Clock, badge: "12" },
      { key: "notes", icon: FileText, badge: "8" },
    ],
  },
  {
    label: "Discover",
    items: [
      { key: "starred", icon: Star, badge: null },
      { key: "tags", icon: Tag, badge: null },
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

export function Sidebar({ activePanel, onNavigate }: SidebarProps) {
  const t = useTranslations("nav")

  const renderItem = (item: { key: string; icon: ElementType; badge: string | null }) => (
    <button
      key={item.key}
      onClick={() => onNavigate?.(item.key)}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 mx-2 rounded-[10px] text-[13.5px] font-[470] transition-all duration-150",
        "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
        activePanel === item.key &&
          "bg-[var(--bg-active)] text-[var(--text-primary)] font-[550] shadow-[inset_2px_0_0_var(--text-primary)]",
      )}
    >
      <item.icon className="w-[18px] h-[18px] shrink-0" />
      <span className="flex-1 text-left">{t(item.key)}</span>
      {item.badge && (
        <span className="ml-auto bg-[var(--accent-soft)] text-[var(--text-secondary)] text-[11px] font-semibold px-[7px] py-[2px] rounded-[10px]">
          {item.badge}
        </span>
      )}
    </button>
  )

  return (
    <aside className="w-[220px] border-r border-[var(--border-subtle)] flex flex-col py-3 select-none shrink-0"
      style={{ background: "var(--surface-1)", backdropFilter: "blur(20px) saturate(180%)" }}>
      {sections.map((section) => (
        <div key={section.label}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.6px] text-[var(--text-tertiary)] px-3 pt-4 pb-1.5">
            {section.label}
          </div>
          {section.items.map(renderItem)}
        </div>
      ))}

      <div className="flex-1" />

      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.6px] text-[var(--text-tertiary)] px-3 pt-4 pb-1.5">
          Settings
        </div>
        {bottomItems.map(renderItem)}
      </div>
    </aside>
  )
}
