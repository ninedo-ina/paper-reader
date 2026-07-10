"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { cn } from "@/lib/utils"

export interface TabDef {
  key: string
  label: string
  count?: number
}

interface TabBarProps {
  tabs: TabDef[]
  activeKey: string
  onChange: (key: string) => void
}

export function TabBar({ tabs, activeKey, onChange }: TabBarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 })

  const updateIndicator = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const activeBtn = container.querySelector(`[data-tab-key="${activeKey}"]`) as HTMLElement | null
    if (activeBtn) {
      const rect = activeBtn.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      setIndicatorStyle({
        left: rect.left - containerRect.left,
        width: rect.width,
      })
    }
  }, [activeKey])

  useEffect(() => {
    updateIndicator()
    const observer = new ResizeObserver(updateIndicator)
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [updateIndicator])

  return (
    <div ref={containerRef} className="relative flex border-b border-[var(--border-subtle)]">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          data-tab-key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={cn(
            "relative flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors duration-150",
            activeKey === tab.key
              ? "text-[var(--accent)]"
              : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
          )}
        >
          {tab.label}
          {tab.count !== undefined && tab.count > 0 && (
            <span
              className={cn(
                "inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-semibold px-1",
                activeKey === tab.key
                  ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                  : "bg-[var(--surface-2)] text-[var(--text-tertiary)]",
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
      <div
        className="absolute bottom-0 h-0.5 bg-[var(--accent)] transition-all duration-300 ease-out"
        style={{ left: indicatorStyle.left, width: indicatorStyle.width }}
      />
    </div>
  )
}
