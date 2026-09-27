"use client"

import { useCallback, useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Loader2, X, Trash2, Link2, Copy, Ban } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { listCollaborators, addCollaborator, removeCollaborator } from "@/lib/api/collaborators"
import { listShareLinks, createShareLink, revokeShareLink } from "@/lib/api/shares"
import type { CollaboratorDto, ShareLinkDto } from "@/lib/api/types"
import { useToastStore } from "@/stores/toast-store"

interface CollabPanelProps {
  paperId: number
  onClose: () => void
}

/**
 * 协作与分享管理（W7，仅作者可见）。左半管结构化协作者（按邮箱加人、定 EDITOR/VIEWER、移除），
 * 右半管只读分享链接（签发 / 复制 / 撤销）。所有判权在后端，这里只做作者自己的管理面板。
 */
export function CollabPanel({ paperId, onClose }: CollabPanelProps) {
  const t = useTranslations("collab")
  const tc = useTranslations("common")
  const locale = useLocale()
  const addToast = useToastStore((s) => s.addToast)

  const [collaborators, setCollaborators] = useState<CollaboratorDto[]>([])
  const [shares, setShares] = useState<ShareLinkDto[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"EDITOR" | "VIEWER">("EDITOR")
  const [adding, setAdding] = useState(false)
  const [creatingShare, setCreatingShare] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([listCollaborators(paperId), listShareLinks(paperId)])
      .then(([cs, ss]) => {
        if (cancelled) return
        setCollaborators(cs)
        setShares(ss)
      })
      .catch((e) => addToast({ message: (e as Error).message, type: "error" }))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [paperId, addToast])
  // APPEND_MARKER

  const add = useCallback(async () => {
    const value = email.trim()
    if (!value || adding) return
    setAdding(true)
    try {
      const created = await addCollaborator(paperId, { email: value, role })
      // 同一人再加一次 = 改角色：先剔除旧登记再插入，避免列表出现重复项。
      setCollaborators((cs) => [...cs.filter((c) => c.userId !== created.userId), created])
      setEmail("")
    } catch (e) {
      addToast({ message: (e as Error).message, type: "error" })
    } finally {
      setAdding(false)
    }
  }, [email, role, adding, paperId, addToast])

  const removeCollab = useCallback(
    async (c: CollaboratorDto) => {
      try {
        await removeCollaborator(paperId, c.userId)
        setCollaborators((cs) => cs.filter((x) => x.id !== c.id))
      } catch (e) {
        addToast({ message: (e as Error).message, type: "error" })
      }
    },
    [paperId, addToast],
  )

  const createShare = useCallback(async () => {
    if (creatingShare) return
    setCreatingShare(true)
    try {
      const s = await createShareLink(paperId, {})
      setShares((ss) => [s, ...ss])
    } catch (e) {
      addToast({ message: (e as Error).message, type: "error" })
    } finally {
      setCreatingShare(false)
    }
  }, [creatingShare, paperId, addToast])

  const revoke = useCallback(
    async (s: ShareLinkDto) => {
      try {
        await revokeShareLink(paperId, s.id)
        setShares((ss) => ss.map((x) => (x.id === s.id ? { ...x, revoked: true } : x)))
      } catch (e) {
        addToast({ message: (e as Error).message, type: "error" })
      }
    },
    [paperId, addToast],
  )

  const copy = useCallback(
    async (token: string) => {
      const url = `${typeof window !== "undefined" ? window.location.origin : ""}/${locale}/share/${token}`
      try {
        await navigator.clipboard.writeText(url)
        addToast({ message: t("copied"), type: "success" })
      } catch {
        addToast({ message: t("copyFailed"), type: "error" })
      }
    },
    [locale, addToast, t],
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-surface-strong rounded-xl border border-white/10 w-full max-w-lg mx-4 p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t("title")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[var(--surface-2)] text-[var(--text-tertiary)]"
            aria-label={tc("cancel")}
          >
            <X className="size-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-[var(--text-tertiary)]">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* 协作者 */}
            <section>
              <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">{t("collaborators")}</h3>
              <div className="space-y-1.5 mb-3">
                {collaborators.length === 0 ? (
                  <p className="text-xs text-[var(--text-tertiary)]">{t("noCollaborators")}</p>
                ) : (
                  collaborators.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-sm"
                    >
                      <span className="min-w-0 truncate text-[var(--text-primary)]">{c.displayName || c.email}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-[var(--text-tertiary)]">{t(`role_${c.role}`)}</span>
                        <button
                          type="button"
                          onClick={() => removeCollab(c)}
                          title={t("removeCollaborator")}
                          className="p-0.5 rounded hover:bg-[var(--surface-2)] text-[var(--text-tertiary)] hover:text-red-500"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && add()}
                  placeholder={t("emailPlaceholder")}
                  className="flex-1 min-w-0 rounded-lg border border-[var(--border-color)] bg-[var(--surface-0)] px-2.5 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]/40"
                />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as "EDITOR" | "VIEWER")}
                  className="rounded-lg border border-[var(--border-color)] bg-[var(--surface-0)] px-2 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none"
                >
                  <option value="EDITOR">{t("role_EDITOR")}</option>
                  <option value="VIEWER">{t("role_VIEWER")}</option>
                </select>
                <Button size="sm" onClick={add} disabled={adding || !email.trim()}>
                  {adding ? <Loader2 className="size-4 animate-spin" /> : t("add")}
                </Button>
              </div>
            </section>

            {/* 只读分享链接 */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-[var(--text-secondary)]">{t("shareLinks")}</h3>
                <Button size="sm" variant="secondary" onClick={createShare} disabled={creatingShare}>
                  {creatingShare ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
                  <span className="ml-1.5">{t("createLink")}</span>
                </Button>
              </div>
              <div className="space-y-1.5">
                {shares.length === 0 ? (
                  <p className="text-xs text-[var(--text-tertiary)]">{t("noShareLinks")}</p>
                ) : (
                  shares.map((s) => (
                    <div
                      key={s.id}
                      className={`flex items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-sm ${s.revoked ? "opacity-50" : ""}`}
                    >
                      <span className="min-w-0 truncate font-mono text-xs text-[var(--text-secondary)]">
                        /share/{s.token}
                      </span>
                      <span className="flex items-center gap-1 shrink-0">
                        {s.revoked ? (
                          <span className="text-xs text-[var(--text-tertiary)]">{t("revoked")}</span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => copy(s.token)}
                              title={t("copyLink")}
                              className="p-0.5 rounded hover:bg-[var(--surface-2)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                            >
                              <Copy className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => revoke(s)}
                              title={t("revoke")}
                              className="p-0.5 rounded hover:bg-[var(--surface-2)] text-[var(--text-tertiary)] hover:text-red-500"
                            >
                              <Ban className="size-3.5" />
                            </button>
                          </>
                        )}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
