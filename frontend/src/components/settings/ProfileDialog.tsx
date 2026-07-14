"use client"

import { useState, useRef, useCallback } from "react"
import { X, User, Lock, Shield, Camera, Upload, Link } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUserStore } from "@/stores/user-store"
import { useToastStore } from "@/stores/toast-store"
import * as authApi from "@/lib/api/auth"

type ProfileTab = "info" | "password" | "2fa"

const TABS: { key: ProfileTab; label: string; icon: React.ReactNode }[] = [
  { key: "info", label: "基本信息", icon: <User className="size-4" /> },
  { key: "password", label: "密码安全", icon: <Lock className="size-4" /> },
  { key: "2fa", label: "两步验证", icon: <Shield className="size-4" /> },
]

interface ProfileDialogProps {
  open: boolean
  onClose: () => void
}

export function ProfileDialog({ open, onClose }: ProfileDialogProps) {
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
          <nav className="flex-1 overflow-auto px-2 pb-2 pt-3">
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
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Right content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)]">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              {TABS.find((t) => t.key === activeTab)?.label}
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
          </div>
        </div>
      </div>
    </div>
  )
}

function AvatarSection({ profile, onUpdate }: { profile: ReturnType<typeof useUserStore.getState>["profile"]; onUpdate: () => void }) {
  const [showOverlay, setShowOverlay] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [urlInput, setUrlInput] = useState("")
  const [showUrlInput, setShowUrlInput] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const avatarUrl = profile?.avatarUrl
  const displayName = profile?.displayName || profile?.email?.split("@")[0] || "?"
  const initial = displayName.charAt(0).toUpperCase()

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Convert to base64 data URL (simple local avatar approach)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        await authApi.updateProfile({ avatarUrl: reader.result as string })
        useToastStore.getState().addToast({ message: "头像已更新", type: "success" })
        onUpdate()
      } catch {
        useToastStore.getState().addToast({ message: "头像更新失败", type: "error" })
      }
    }
    reader.readAsDataURL(file)
    setMenuOpen(false)
  }, [onUpdate])

  const handleUrlSubmit = useCallback(async () => {
    if (!urlInput.trim()) return
    try {
      await authApi.updateProfile({ avatarUrl: urlInput.trim() })
      useToastStore.getState().addToast({ message: "头像已更新", type: "success" })
      onUpdate()
      setUrlInput("")
      setShowUrlInput(false)
    } catch {
      useToastStore.getState().addToast({ message: "头像更新失败", type: "error" })
    }
    setMenuOpen(false)
  }, [urlInput, onUpdate])

  return (
    <div className="px-4 py-5 border-b border-[var(--border-subtle)]">
      <div className="flex flex-col items-center gap-3">
        {/* Avatar */}
        <div
          className="relative"
          onMouseEnter={() => setShowOverlay(true)}
          onMouseLeave={() => setShowOverlay(false)}
        >
          <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold">{initial}</span>
            )}
          </div>

          {/* Hover overlay */}
          {showOverlay && (
            <button
              className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 transition-all"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Camera className="size-5 text-white" />
            </button>
          )}

          {/* Upload menu */}
          {menuOpen && (
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-40 rounded-xl shadow-lg border border-[var(--border-subtle)] glass-surface-strong py-1 z-[80]">
              {showUrlInput ? (
                <div className="px-2 py-1.5">
                  <input
                    autoFocus
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="图片 URL..."
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
                    从本地上传
                  </button>
                  <button
                    onClick={() => setShowUrlInput(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <Link className="size-3.5" />
                    网络图片
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
  const [displayName, setDisplayName] = useState(profile?.displayName || "")
  const [saving, setSaving] = useState(false)

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await authApi.updateProfile({ displayName: displayName || undefined })
      useToastStore.getState().addToast({ message: "资料已更新", type: "success" })
      onUpdate()
    } catch {
      useToastStore.getState().addToast({ message: "更新失败", type: "error" })
    } finally {
      setSaving(false)
    }
  }, [displayName, onUpdate])

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[var(--text-secondary)]">显示名称</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[var(--text-secondary)]">邮箱</label>
        <input
          readOnly
          value={profile?.email || ""}
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--text-tertiary)] cursor-not-allowed"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[var(--text-secondary)]">登录方式</label>
        <input
          readOnly
          value={profile?.authProvider || ""}
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--text-tertiary)] cursor-not-allowed"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
        style={{ background: "var(--accent)" }}
      >
        {saving ? "保存中..." : "保存"}
      </button>
    </div>
  )
}

function PasswordTab() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [saving, setSaving] = useState(false)

  const handleChange = useCallback(async () => {
    if (!currentPassword || !newPassword) {
      useToastStore.getState().addToast({ message: "请填写所有密码字段", type: "error" })
      return
    }
    if (newPassword.length < 6) {
      useToastStore.getState().addToast({ message: "新密码至少 6 个字符", type: "error" })
      return
    }
    if (newPassword !== confirmPassword) {
      useToastStore.getState().addToast({ message: "两次输入的新密码不一致", type: "error" })
      return
    }
    setSaving(true)
    try {
      await authApi.changePassword({ currentPassword, newPassword })
      useToastStore.getState().addToast({ message: "密码已修改", type: "success" })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (e) {
      useToastStore.getState().addToast({ message: (e as Error).message || "密码修改失败", type: "error" })
    } finally {
      setSaving(false)
    }
  }, [currentPassword, newPassword, confirmPassword])

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[var(--text-secondary)]">当前密码</label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[var(--text-secondary)]">新密码</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[var(--text-secondary)]">确认新密码</label>
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
        className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
        style={{ background: "var(--accent)" }}
      >
        {saving ? "修改中..." : "修改密码"}
      </button>
    </div>
  )
}

function TwoFactorTab() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center pt-16">
      <Shield className="size-12 text-[var(--text-tertiary)] mb-4" />
      <h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">两步验证</h3>
      <p className="text-xs text-[var(--text-tertiary)] max-w-[260px]">
        两步验证功能正在开发中，上线后将支持通过身份验证器应用或短信进行二次验证。
      </p>
    </div>
  )
}
