"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { X, User, Lock, Shield, Clock, MonitorSmartphone, Loader2, Camera, Upload, Link } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { useUserStore } from "@/stores/user-store"
import { useToastStore } from "@/stores/toast-store"
import { defaultAvatar, defaultDisplayName } from "@/lib/user-display"
import * as authApi from "@/lib/api/auth"
import { TwoFactorTab } from "./TwoFactorTab"
import { TrustedDevicesTab } from "./TrustedDevicesTab"

type ProfileTab = "info" | "password" | "2fa" | "devices" | "audit"

/** 后端 pr_users.avatar_url 放宽到 VARCHAR(1000000)，留点余量给 JSON 转义 */
const MAX_AVATAR_DATA_URL_LENGTH = 900_000

const TABS: { key: ProfileTab; labelKey: string; icon: React.ReactNode }[] = [
  { key: "info", labelKey: "tabInfo", icon: <User className="size-4" /> },
  { key: "password", labelKey: "tabPassword", icon: <Lock className="size-4" /> },
  { key: "2fa", labelKey: "tabTwoFactor", icon: <Shield className="size-4" /> },
  { key: "devices", labelKey: "tabDevices", icon: <MonitorSmartphone className="size-4" /> },
  { key: "audit", labelKey: "tabAudit", icon: <Clock className="size-4" /> },
]

interface ProfileDialogProps {
  open: boolean
  onClose: () => void
}

export function ProfileDialog({ open, onClose }: ProfileDialogProps) {
  const t = useTranslations("settings")
  const { profile, loadProfile } = useUserStore()
  const [activeTab, setActiveTab] = useState<ProfileTab>("info")

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[800px] h-[560px] glass-surface-strong rounded-2xl border border-[var(--border-color)] shadow-2xl flex overflow-hidden">
        {/* Left menu */}
        <div className="w-[220px] border-r border-[var(--border-subtle)] flex flex-col shrink-0">
          {/* Avatar header */}
          <AvatarSection profile={profile} onUpdate={loadProfile} />

          {/* Menu items */}
          <nav className="flex-1 overflow-auto px-2 pb-2 pt-3 flex flex-col gap-y-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                  activeTab === tab.key
                    ? "bg-[var(--accent)]/10 text-[var(--accent)] font-medium"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]",
                )}
              >
                <span className="shrink-0">{tab.icon}</span>
                <span>{t(tab.labelKey)}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Right content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)]">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              {TABS.find((tab) => tab.key === activeTab)?.labelKey && t(TABS.find((tab) => tab.key === activeTab)!.labelKey)}
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-[var(--bg-hover)] transition-colors"
            >
              <X className="size-4 text-[var(--text-tertiary)]" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-5">
            {activeTab === "info" && <BasicInfoTab profile={profile} onUpdate={loadProfile} />}
            {activeTab === "password" && <PasswordTab />}
            {activeTab === "2fa" && <TwoFactorTab />}
            {activeTab === "devices" && <TrustedDevicesTab />}
            {activeTab === "audit" && <AuditLogTab />}
          </div>
        </div>
      </div>
    </div>
  )
}

function AvatarSection({ profile, onUpdate }: { profile: ReturnType<typeof useUserStore.getState>["profile"]; onUpdate: () => void }) {
  const t = useTranslations("settings")
  const [showOverlay, setShowOverlay] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [urlInput, setUrlInput] = useState("")
  const [showUrlInput, setShowUrlInput] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const avatarRef = useRef<HTMLDivElement>(null)

  const avatarUrl = profile?.avatarUrl
  const displayName = defaultDisplayName(profile)
  // 没上传头像时给一个稳定的默认头像：邮箱首字符 + 纯色底，而不是问号
  const avatar = defaultAvatar(profile?.email, displayName)

  // 点击弹窗外的空白区域要收起上传菜单（点「从本地上传」弹出的文件框不算）
  useEffect(() => {
    if (!menuOpen) return
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node
      if (menuRef.current?.contains(target)) return
      // 触发按钮在 menuRef 之外，点它交给 onClick 自己切换，避免开了立刻又关
      if (avatarRef.current?.contains(target)) return
      setMenuOpen(false)
      setShowUrlInput(false)
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false)
        setShowUrlInput(false)
      }
    }
    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [menuOpen])

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Convert to base64 data URL (simple local avatar approach)
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result as string
      // base64 会把图片撑大约三分之一，后端头像列放不下就别发了，
      // 给个明确的提示，好过让用户看到一句「头像更新失败」
      if (dataUrl.length > MAX_AVATAR_DATA_URL_LENGTH) {
        useToastStore.getState().addToast({ message: "图片太大，请换一张 700KB 以内的图片", type: "error" })
        return
      }
      try {
        await authApi.updateProfile({ avatarUrl: dataUrl })
        useToastStore.getState().addToast({ message: t("avatarUpdated"), type: "success" })
        onUpdate()
      } catch {
        useToastStore.getState().addToast({ message: t("avatarUpdateFailed"), type: "error" })
      }
    }
    reader.readAsDataURL(file)
    setMenuOpen(false)
  }, [onUpdate, t])

  const handleUrlSubmit = useCallback(async () => {
    if (!urlInput.trim()) return
    try {
      await authApi.updateProfile({ avatarUrl: urlInput.trim() })
      useToastStore.getState().addToast({ message: t("avatarUpdated"), type: "success" })
      onUpdate()
      setUrlInput("")
      setShowUrlInput(false)
    } catch {
      useToastStore.getState().addToast({ message: t("avatarUpdateFailed"), type: "error" })
    }
    setMenuOpen(false)
  }, [urlInput, onUpdate, t])

  return (
    <div className="px-4 py-5 border-b border-[var(--border-subtle)]">
      <div className="flex flex-col items-center gap-3">
        {/* Avatar */}
        <div
          ref={avatarRef}
          data-testid="profile-avatar"
          className="relative"
          onMouseEnter={() => setShowOverlay(true)}
          onMouseLeave={() => setShowOverlay(false)}
        >
          <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center"
            style={{ background: avatar.background, color: avatar.foreground }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold">{avatar.initial}</span>
            )}
          </div>

          {/* Hover overlay */}
          {showOverlay && (
            <button
              className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 transition-all"
              aria-label="更换头像"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Camera className="size-5 text-white" />
            </button>
          )}

          {/* Upload menu */}
          {menuOpen && (
            <div ref={menuRef} className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-40 rounded-xl shadow-lg border border-[var(--border-subtle)] glass-surface-strong py-1 z-[80]">
              {showUrlInput ? (
                <div className="px-2 py-1.5">
                  <input
                    autoFocus
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder={t("imageUrlPlaceholder")}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    onKeyDown={(e) => { if (e.key === "Enter") handleUrlSubmit() }}
                  />
                </div>
              ) : (
                <>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <Upload className="size-3.5" />
                    {t("uploadLocal")}
                  </button>
                  <button
                    onClick={() => setShowUrlInput(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <Link className="size-3.5" />
                    {t("imageUrl")}
                  </button>
                </>
              )}
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>

        <span className="text-sm font-medium text-[var(--text-primary)]">{displayName}</span>
      </div>
    </div>
  )
}

function BasicInfoTab({
  profile,
  onUpdate,
}: {
  profile: ReturnType<typeof useUserStore.getState>["profile"]
  onUpdate: () => void
}) {
  const t = useTranslations("settings")
  const tc = useTranslations("common")
  const [displayName, setDisplayName] = useState(profile?.displayName || "")
  const [saving, setSaving] = useState(false)
  // 没自定义名字时，界面上显示的就是系统生成的「用户{id}」，把它作为占位提示
  const fallbackName = defaultDisplayName(profile)

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await authApi.updateProfile({ displayName: displayName || undefined })
      useToastStore.getState().addToast({ message: t("profileUpdated"), type: "success" })
      onUpdate()
    } catch {
      useToastStore.getState().addToast({ message: t("updateFailed"), type: "error" })
    } finally {
      setSaving(false)
    }
  }, [displayName, onUpdate, t])

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[var(--text-secondary)]">{t("displayName")}</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={fallbackName}
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[var(--text-secondary)]">{t("email")}</label>
        <input
          readOnly
          value={profile?.email || ""}
          placeholder="未绑定邮箱"
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--text-tertiary)] cursor-not-allowed placeholder:text-[var(--text-placeholder)]"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-[var(--surface-1)] transition-all disabled:opacity-60 hover:brightness-110"
        style={{ background: "var(--accent)" }}
      >
        {saving && <Loader2 className="size-3.5 animate-spin" />}
        {saving ? t("saving") : tc("save")}
      </button>
    </div>
  )
}

function PasswordTab() {
  const t = useTranslations("settings")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [saving, setSaving] = useState(false)

  const handleChange = useCallback(async () => {
    if (!currentPassword || !newPassword) {
      useToastStore.getState().addToast({ message: t("passwordAllFields"), type: "error" })
      return
    }
    if (newPassword.length < 6) {
      useToastStore.getState().addToast({ message: t("passwordTooShort"), type: "error" })
      return
    }
    if (newPassword !== confirmPassword) {
      useToastStore.getState().addToast({ message: t("passwordMismatch"), type: "error" })
      return
    }
    setSaving(true)
    try {
      await authApi.changePassword({ currentPassword, newPassword })
      useToastStore.getState().addToast({ message: t("passwordChanged"), type: "success" })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (e) {
      useToastStore.getState().addToast({ message: (e as Error).message || t("passwordChangeFailed"), type: "error" })
    } finally {
      setSaving(false)
    }
  }, [currentPassword, newPassword, confirmPassword, t])

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[var(--text-secondary)]">{t("currentPassword")}</label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[var(--text-secondary)]">{t("newPassword")}</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[var(--text-secondary)]">{t("confirmNewPassword")}</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
      </div>

      <button
        onClick={handleChange}
        disabled={saving}
        className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--surface-1)] transition-colors disabled:opacity-50"
        style={{ background: "var(--accent)" }}
      >
        {saving ? t("changing") : t("changePassword")}
      </button>
    </div>
  )
}

function AuditLogTab() {
  const t = useTranslations("settings")
  const locale = useLocale()
  const [logs, setLogs] = useState<Array<{ id: number; event: string; operator: string; createdAt: string }>>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)

  const loadLogs = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const { getAuditLogs } = await import("@/lib/api/audit-log")
      const res = await getAuditLogs(p, 20)
      if (p === 0) {
        setLogs(res.items)
      } else {
        setLogs((prev) => [...prev, ...res.items])
      }
      setHasMore(res.items.length === 20)
    } catch {
      // API may not be deployed yet — silent
      if (p === 0) setLogs([])
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLogs(0)
  }, [loadLogs])

  return (
    <div className="space-y-4">
      {logs.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center pt-16 text-center">
          <Clock className="size-12 text-[var(--text-tertiary)] mb-4" />
          <h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">{t("auditTitle")}</h3>
          <p className="text-xs text-[var(--text-tertiary)] max-w-[260px]">
            {t("auditEmpty")}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-2)]">
                  <th className="px-4 py-2.5 text-start text-xs font-medium text-[var(--text-secondary)]">{t("auditIndex")}</th>
                  <th className="px-4 py-2.5 text-start text-xs font-medium text-[var(--text-secondary)]">{t("auditEvent")}</th>
                  <th className="px-4 py-2.5 text-start text-xs font-medium text-[var(--text-secondary)]">{t("auditOperator")}</th>
                  <th className="px-4 py-2.5 text-start text-xs font-medium text-[var(--text-secondary)]">{t("auditTime")}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => (
                  <tr key={log.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors">
                    <td className="px-4 py-2.5 text-[var(--text-tertiary)]">{page * 20 + idx + 1}</td>
                    <td className="px-4 py-2.5 text-[var(--text-primary)] font-medium">{log.event}</td>
                    <td className="px-4 py-2.5 text-[var(--text-secondary)]">{log.operator}</td>
                    <td className="px-4 py-2.5 text-[var(--text-tertiary)] text-xs">
                      {new Date(log.createdAt).toLocaleString(locale, {
                        year: "numeric", month: "2-digit", day: "2-digit",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <button
              onClick={() => { const next = page + 1; setPage(next); loadLogs(next) }}
              disabled={loading}
              className="w-full py-2 text-sm text-[var(--accent)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? t("loadingMore") : t("loadMore")}
            </button>
          )}
        </>
      )}
    </div>
  )
}
