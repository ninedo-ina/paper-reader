"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Search, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

export function SearchDialog() {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [visible, setVisible] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Cmd/Ctrl+K 快捷键 / keyboard shortcut
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === "Escape") {
        setOpen(false)
      }
    },
    [],
  )

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  // 打开时触发进场动画 + 自动聚焦 / animate in + auto-focus
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setVisible(true))
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setVisible(false)
      setQuery("")
    }
  }, [open])

  const handleClose = () => setOpen(false)

  return (
    <>
      {/* 搜索按钮 / search trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex size-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
        title={t("reader.search")}
      >
        <Search className="size-4" />
      </button>

      {/* 搜索弹窗遮罩 / overlay */}
      {open && (
        <div
          className={cn(
            "fixed inset-0 z-[60] flex items-start justify-center pt-[20vh]",
            "bg-black/30 backdrop-blur-sm",
            "transition-opacity duration-200",
            visible ? "opacity-100" : "opacity-0",
          )}
          onClick={handleClose}
        >
          {/* 搜索面板 / search panel */}
          <div
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "w-full max-w-xl mx-4 rounded-2xl border border-[var(--border-subtle)]",
              "bg-[var(--surface-0)] shadow-2xl overflow-hidden",
              "transition-all duration-200 origin-top",
              visible ? "scale-100 opacity-100" : "scale-95 opacity-0",
            )}
          >
            {/* 输入行 / input row */}
            <div className="flex items-center gap-3 px-4 h-14">
              <Search className="size-5 text-[var(--text-tertiary)] shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("reader.search")}
                className="flex-1 bg-transparent text-[var(--text-primary)] text-base outline-none placeholder:text-[var(--text-tertiary)]"
              />
              <button
                onClick={handleClose}
                className="flex size-6 items-center justify-center rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* 结果区域占位 / results area placeholder */}
            {query && (
              <div className="border-t border-[var(--border-subtle)] px-4 py-8 text-center text-sm text-[var(--text-tertiary)]">
                {t("reader.searchPlaceholder") || "Search papers..."}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
