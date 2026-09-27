"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Loader2, Check, Trash2, Send, X } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { listComments, createComment, updateComment, deleteComment } from "@/lib/api/comments"
import type { PaperCommentDto } from "@/lib/api/types"
import { useToastStore } from "@/stores/toast-store"

interface CommentsSidebarProps {
  paperId: number
  /** 当前用户 id，用来判断哪些批注是自己的（可改正文/可删）。 */
  meId: number
  /** 是否可写（作者或 EDITOR）：可标记任意批注为已解决。 */
  canWrite: boolean
  /** 是否为论文作者：可删除任意批注。 */
  isOwner: boolean
  onClose: () => void
}

/**
 * 正文批注侧栏（W7）。任何可读者都能新建批注（含只读的导师）；
 * 「标记已解决」作者或 EDITOR 可做，删除限批注作者或论文作者。后端才是最终判权方，
 * 这里只按角色隐藏用不上的按钮，避免误点后被拒。
 */
export function CommentsSidebar({ paperId, meId, canWrite, isOwner, onClose }: CommentsSidebarProps) {
  const t = useTranslations("comments")
  const [comments, setComments] = useState<PaperCommentDto[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const addToast = useToastStore((s) => s.addToast)

  const reload = useCallback(() => {
    setLoading(true)
    listComments(paperId)
      .then(setComments)
      .catch((e) => addToast({ message: (e as Error).message, type: "error" }))
      .finally(() => setLoading(false))
  }, [paperId, addToast])

  useEffect(() => {
    reload()
  }, [reload])

  const submit = useCallback(async () => {
    const body = draft.trim()
    if (!body || submitting) return
    setSubmitting(true)
    try {
      const created = await createComment(paperId, { body })
      setComments((cs) => [...cs, created])
      setDraft("")
    } catch (e) {
      addToast({ message: (e as Error).message, type: "error" })
    } finally {
      setSubmitting(false)
    }
  }, [draft, submitting, paperId, addToast])

  const toggleResolved = useCallback(
    async (c: PaperCommentDto) => {
      try {
        const updated = await updateComment(paperId, c.id, { resolved: !c.resolved })
        setComments((cs) => cs.map((x) => (x.id === updated.id ? updated : x)))
      } catch (e) {
        addToast({ message: (e as Error).message, type: "error" })
      }
    },
    [paperId, addToast],
  )

  const remove = useCallback(
    async (c: PaperCommentDto) => {
      try {
        await deleteComment(paperId, c.id)
        setComments((cs) => cs.filter((x) => x.id !== c.id))
      } catch (e) {
        addToast({ message: (e as Error).message, type: "error" })
      }
    },
    [paperId, addToast],
  )

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg-root)" }}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t("title")}</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-[var(--surface-2)] text-[var(--text-tertiary)]"
          aria-label={t("close")}
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-[var(--text-tertiary)]">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-xs text-[var(--text-tertiary)] py-6 text-center">{t("empty")}</p>
        ) : (
          comments.map((c) => (
            <div
              key={c.id}
              className={`rounded-lg border border-[var(--border-subtle)] p-2.5 text-sm ${c.resolved ? "opacity-55" : ""}`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-medium text-[var(--text-secondary)] truncate">
                  {c.authorName || t("someone")}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {(canWrite || c.userId === meId) && (
                    <button
                      type="button"
                      onClick={() => toggleResolved(c)}
                      title={c.resolved ? t("reopen") : t("resolve")}
                      className={`p-0.5 rounded hover:bg-[var(--surface-2)] ${c.resolved ? "text-green-500" : "text-[var(--text-tertiary)]"}`}
                    >
                      <Check className="size-3.5" />
                    </button>
                  )}
                  {(isOwner || c.userId === meId) && (
                    <button
                      type="button"
                      onClick={() => remove(c)}
                      title={t("delete")}
                      className="p-0.5 rounded hover:bg-[var(--surface-2)] text-[var(--text-tertiary)] hover:text-red-500"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {c.quote && (
                <p className="text-xs text-[var(--text-tertiary)] border-l-2 border-[var(--accent)]/40 pl-2 mb-1 line-clamp-2">
                  {c.quote}
                </p>
              )}
              <p className="text-[var(--text-primary)] whitespace-pre-wrap break-words">{c.body}</p>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-[var(--border-subtle)] p-2.5">
        <textarea
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("placeholder")}
          className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-0)] px-2.5 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]/40 resize-y"
        />
        <div className="flex justify-end mt-2">
          <Button size="sm" onClick={submit} disabled={submitting || !draft.trim()}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            <span className="ml-1.5">{t("send")}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
