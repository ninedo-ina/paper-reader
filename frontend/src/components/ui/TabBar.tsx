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
      {tabs.map((tab) => {
        const badge =
          tab.count !== undefined && tab.count > 0
            ? tab.count > 99
              ? "99+"
              : String(tab.count)
            : null

        return (
          <button
            key={tab.key}
            data-tab-key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            aria-label={badge ? `${tab.label} (${badge})` : undefined}
            className={cn(
              "relative flex-1 flex items-center justify-center px-3 py-2.5 text-sm font-medium transition-colors duration-150",
              activeKey === tab.key
                ? "text-[var(--accent)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
            )}
          >
            {/* The badge is a corner superscript, absolutely positioned so it never
                takes width from the label. As an in-flow flex sibling it used to
                squeeze the label until CJK glyphs wrapped one character per line in
                the narrow (288px aside) equal-width tabs. */}
            <span className="relative inline-flex min-w-0 max-w-full items-center justify-center">
              <span className="min-w-0 truncate">{tab.label}</span>
              {badge && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute -top-2 -end-2 inline-flex h-[16px] min-w-[16px] items-center justify-center whitespace-nowrap rounded-full border bg-[var(--surface-2)] px-1 text-[10px] font-semibold leading-none",
                    activeKey === tab.key
                      ? "border-[var(--accent)] text-[var(--accent)]"
                      : "border-[var(--border-subtle)] text-[var(--text-tertiary)]",
                  )}
                >
                  {badge}
                </span>
              )}
            </span>
          </button>
        )
      })}
      <div
        className="absolute bottom-0 h-0.5 bg-[var(--accent)] transition-all duration-300 ease-out"
        style={{ left: indicatorStyle.left, width: indicatorStyle.width }}
      />
    </div>
  )
}
