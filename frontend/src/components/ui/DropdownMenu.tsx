"use client"

import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

export interface DropdownItem {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  danger?: boolean
}

interface DropdownMenuProps {
  items: DropdownItem[]
  open: boolean
  onClose: () => void
  triggerRef: React.RefObject<HTMLElement | null>
}

export function DropdownMenu({ items, open, onClose, triggerRef }: DropdownMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPosition({ top: rect.bottom + 4, left: Math.max(8, rect.right - 160) })
  }, [open, triggerRef])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target)) return
      if (triggerRef.current?.contains(target)) return
      onClose()
    }
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", handler)
    document.addEventListener("keydown", keyHandler)
    return () => {
      document.removeEventListener("mousedown", handler)
      document.removeEventListener("keydown", keyHandler)
    }
  }, [open, onClose, triggerRef])

  if (!open || !position) return null

  return (
    <div
      ref={menuRef}
      style={{ top: position.top, left: position.left }}
      className="fixed z-50 min-w-[140px] py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-0)] shadow-lg"
    >
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          onClick={() => {
            item.onClick()
            onClose()
          }}
          className={cn(
            "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors",
            item.danger
              ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              : "text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
          )}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  )
}
