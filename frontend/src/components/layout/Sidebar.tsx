"use client"

import { useState, useEffect, type ElementType } from "react"
import { useTranslations } from "next-intl"
import { Library, Clock, FileText, PenLine, Tag, MessageCircle, MessageSquare, PanelLeftClose, PanelLeftOpen, Highlighter } from "lucide-react"
import { cn } from "@/lib/utils"
import { usePaperStore } from "@/stores/paper-store"
import { useAuthStore } from "@/stores/auth-store"
import { PaperHelperBrand, PaperHelperMark } from "@/components/ui/Logo"

const sections = [
  {
    labelKey: "sectionLibrary",
    items: [
      { key: "library", icon: Library, dynamicBadge: true },
      { key: "history", icon: Clock, badge: "0" },
      { key: "created", icon: PenLine, dynamicBadge: true },
    ],
  },
  {
    labelKey: "sectionDiscover",
    items: [
      { key: "notes", icon: FileText, badge: "0" },
      { key: "annotations", icon: Highlighter, badge: "0" },
      { key: "tags", icon: Tag, badge: "0" },
    ],
  },
  {
    labelKey: "sectionCommunication",
    items: [
      { key: "circle", icon: MessageCircle, dynamicBadge: true },
      { key: "chats", icon: MessageSquare, dynamicBadge: true },
    ],
  },
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
  const { totalCount, createCount, forumBadge, activeTab, loadCounts } = usePaperStore()
  const accessToken = useAuthStore((s) => s.accessToken)

  useEffect(() => {
    if (accessToken) {
      loadCounts()
    }
  }, [accessToken, loadCounts])

  const papersBadge = totalCount > 99 ? "99+" : String(totalCount)
  const forumBadgeStr = forumBadge > 99 ? "99+" : String(forumBadge)

  const renderCollapsedItem = (item: SidebarItem) => (
    <button
      key={item.key}
      onClick={() => onNavigate?.(item.key)}
      title={t(item.key)}
      className={cn(
        "flex items-center justify-center w-9 h-9 mx-auto rounded-[10px] transition-all duration-150",
        "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
        ((activePanel === item.key && !(item.key === "library" && activeTab === "create")) || (item.key === "created" && activePanel === "library" && activeTab === "create")) &&
          "bg-[var(--bg-active)] text-[var(--text-primary)]",
      )}
    >
      <item.icon className="w-[18px] h-[18px]" />
    </button>
  )

  const renderExpandedItem = (item: SidebarItem) => {
    const badge = item.dynamicBadge
      ? (item.key === "circle" ? forumBadgeStr : item.key === "created" ? (createCount > 99 ? "99+" : String(createCount)) : papersBadge)
      : item.badge

    return (
      <button
        key={item.key}
        onClick={() => onNavigate?.(item.key)}
        className={cn(
          "flex items-center gap-2.5 px-3 py-2 mx-1 rounded-[10px] text-[13.5px] font-[470] transition-all duration-150",
          "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
          ((activePanel === item.key && !(item.key === "library" && activeTab === "create")) || (item.key === "created" && activePanel === "library" && activeTab === "create")) &&
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
        "relative z-30 border-r border-[var(--border-subtle)] flex flex-col py-3 select-none shrink-0 transition-all duration-200",
        collapsed ? "w-[52px]" : "w-[220px]",
      )}
      style={{ background: "var(--surface-1)", backdropFilter: "blur(20px) saturate(180%)" }}
    >
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute right-[-10px] top-[18px] z-40 inline-flex size-5 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--surface-1)] text-[var(--text-tertiary)] shadow-[var(--shadow-sm)] transition-all hover:text-[var(--text-primary)] hover:shadow-[var(--shadow-md)]"
      >
        {collapsed ? (
          <PanelLeftOpen className="size-3" />
        ) : (
          <PanelLeftClose className="size-3" />
        )}
      </button>

      {collapsed ? (
        <div className="flex justify-center mb-1">
          <PaperHelperMark className="size-7 rounded-[8px] text-[13px]" />
        </div>
      ) : (
        <div className="flex items-center justify-center px-3 mb-4">
          <PaperHelperBrand />
        </div>
      )}

      {collapsed ? (
        <>
          {sections.map((section) => (
            <div key={section.labelKey} className="flex flex-col items-center gap-1 mt-3">
              {section.items.map(renderCollapsedItem)}
            </div>
          ))}
          <div className="flex-1" />
        </>
      ) : (
        <>
          {sections.map((section) => (
            <div key={section.labelKey}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.6px] text-[var(--text-tertiary)] px-3 pt-4 pb-1.5">
                {t(section.labelKey)}
              </div>
              <div className="flex flex-col gap-y-1">
                {section.items.map(renderExpandedItem)}
              </div>
            </div>
          ))}

          <div className="flex-1" />

          <div className="border-t border-[var(--border-subtle)] px-3 pt-3 pb-1 text-center">
            <p className="text-[13px] font-[650] tracking-[-0.1px] text-[var(--text-primary)]">
              PaperHelper
            </p>
            <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
              More Interest Less Interests
            </p>
          </div>
        </>
      )}
    </aside>
  )
}
