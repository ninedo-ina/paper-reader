"use client"

import { useState, useRef, useEffect } from "react"
import { Bell } from "lucide-react"
import { useTranslations } from "next-intl"
import { useNotificationStore } from "@/stores/notification-store"
import { cn } from "@/lib/utils"

export function NotificationDropdown() {
  const t = useTranslations("notification")
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<"system" | "app">("system")
  const ref = useRef<HTMLDivElement>(null)

  const notifications = useNotificationStore((s) => s.notifications)
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const markRead = useNotificationStore((s) => s.markRead)
  const markAllRead = useNotificationStore((s) => s.markAllRead)
  const setShowVersionPopup = useNotificationStore((s) => s.setShowVersionPopup)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const filtered = notifications.filter((n) => n.type === tab)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative flex size-9 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
      >
        <Bell className="size-5" />
        {unreadCount() > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount() > 9 ? "9+" : unreadCount()}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-0)] shadow-xl z-50">
          {/* Tabs */}
          <div className="flex border-b border-[var(--border-subtle)]">
            {(["system", "app"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setTab(type)}
                className={cn(
                  "flex-1 py-2.5 text-sm font-medium transition-colors",
                  tab === type
                    ? "text-[var(--accent)] border-b-2 border-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                )}
              >
                {type === "system" ? t("systemTab") : t("appTab")}
              </button>
            ))}
          </div>

          {/* Header actions */}
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-xs text-[var(--text-tertiary)]">
              {filtered.length} {t("notifications")}
            </span>
            {filtered.some((n) => !n.read) && (
              <button
                onClick={() => markAllRead(tab)}
                className="text-xs text-[var(--accent)] hover:underline"
              >
                {t("markAllRead")}
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-[var(--text-tertiary)]">
                {t("empty")}
              </div>
            ) : (
              filtered.map((n) => (
                <div
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={cn(
                    "px-4 py-3 border-b border-[var(--border-subtle)] cursor-pointer transition-colors hover:bg-[var(--surface-1)]",
                    !n.read && "bg-[var(--accent)]/5",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {!n.read && (
                          <span className="inline-block size-1.5 rounded-full bg-[var(--accent)] mr-1.5 align-middle" />
                        )}
                        {n.title}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">
                        {n.message}
                      </p>
                    </div>
                    <span className="text-[10px] text-[var(--text-tertiary)] shrink-0">
                      {formatTimestamp(n.timestamp)}
                    </span>
                  </div>
                  {n.actionKey === "version" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowVersionPopup(true)
                        setOpen(false)
                      }}
                      className="mt-2 text-xs text-[var(--accent)] hover:underline"
                    >
                      {t("viewVersion")}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function formatTimestamp(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
