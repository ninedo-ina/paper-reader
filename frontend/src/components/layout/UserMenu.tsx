"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useAuthStore } from "@/stores/auth-store"
import { useUserStore } from "@/stores/user-store"
import { LogOut } from "lucide-react"

export function UserMenu() {
  const t = useTranslations("auth")
  const router = useRouter()
  const { logout } = useAuthStore()
  const { profile, clearProfile } = useUserStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const handleLogout = () => {
    logout()
    clearProfile()
    setOpen(false)
    router.push("/login")
  }

  const displayName = profile?.displayName || profile?.email?.split("@")[0] || "?"
  const avatarUrl = profile?.avatarUrl
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold overflow-hidden"
        style={{ background: "var(--text-primary)", color: "var(--bg-root, #eeeff2)" }}
        title={displayName}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
        ) : (
          initial
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl shadow-lg border border-[var(--border-subtle)] glass-surface-strong py-1.5 z-[100]">
          <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
            <p className="text-sm font-medium text-[var(--text-primary)] truncate">
              {displayName}
            </p>
            <p className="text-xs text-[var(--text-tertiary)] truncate">
              {profile?.email}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <LogOut className="size-4" />
            {t("logout")}
          </button>
        </div>
      )}
    </div>
  )
}
