"use client"

import { useTranslations } from "next-intl"
import { Library, Upload, Clock, FileText, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { key: "library", icon: Library },
  { key: "upload", icon: Upload },
  { key: "history", icon: Clock },
  { key: "notes", icon: FileText },
  { key: "settings", icon: Settings },
] as const

interface SidebarProps {
  activePanel?: string | null
  onNavigate?: (key: string) => void
}

export function Sidebar({ activePanel, onNavigate }: SidebarProps) {
  const t = useTranslations("nav")

  return (
    <aside className="w-55 border-r border-[var(--border-color)] glass-surface flex flex-col py-3 select-none shrink-0">
      {navItems.map((item) => (
        <button
          key={item.key}
          onClick={() => onNavigate?.(item.key)}
          className={cn(
            "flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-all duration-150",
            "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]",
            (activePanel === item.key || (activePanel === null && item.key === "library")) &&
              "bg-[var(--surface-2)] text-[var(--text-primary)]",
          )}
        >
          <item.icon className="size-4.5" />
          <span>{t(item.key)}</span>
        </button>
      ))}
    </aside>
  )
}
