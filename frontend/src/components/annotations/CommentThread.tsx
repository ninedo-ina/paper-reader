"use client"

import { useState, useEffect, useCallback } from "react"
import { Send, Loader2, CornerDownRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { addComment, listComments, deleteComment } from "@/lib/api/annotations"
import type { AnnotationCommentDto } from "@/lib/api/types"
import { useToastStore } from "@/stores/toast-store"

interface CommentThreadProps {
  annotationId: number
}

export function CommentThread({ annotationId }: CommentThreadProps) {
  const [comments, setComments] = useState<AnnotationCommentDto[]>([])
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState("")
  const [replyTo, setReplyTo] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const addToast = useToastStore((s) => s.addToast)

  useEffect(() => {
    setLoading(true)
    listComments(annotationId)
      .then(setComments)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [annotationId])

  const handleSubmit = useCallback(async () => {
    if (!input.trim()) return
    setSubmitting(true)
    try {
      const created = await addComment(annotationId, {
        content: input.trim(),
        parentId: replyTo ?? undefined,
      })
      setComments((prev) => [...prev, created])
      setInput("")
      setReplyTo(null)
    } catch {
      addToast({ message: "评论失败", type: "error" })
    } finally {
      setSubmitting(false)
    }
  }, [annotationId, input, replyTo, addToast])

  // Build a tree: top-level comments and their replies
  const topLevel = comments.filter((c) => !c.parentId)
  const replies = (parentId: number) => comments.filter((c) => c.parentId === parentId)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="size-4 animate-spin text-[var(--text-tertiary)]" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {topLevel.length === 0 && (
        <p className="text-[11px] text-[var(--text-tertiary)] text-center py-2">暂无评论</p>
      )}
      {topLevel.map((c) => (
        <div key={c.id} className="space-y-2">
          <div className="text-[11.5px] text-[var(--text-primary)] leading-relaxed">
            {c.content}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--text-tertiary)]">
              {new Date(c.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
            <button
              onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
              className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
            >
              回复
            </button>
          </div>
          {/* Replies */}
          {replies(c.id).map((r) => (
            <div key={r.id} className="ml-4 pl-3 border-l-2 border-[var(--border-subtle)] space-y-1">
              <div className="flex items-center gap-1 text-[var(--text-tertiary)]">
                <CornerDownRight className="size-2.5" />
                <span className="text-[11.5px] text-[var(--text-primary)]">{r.content}</span>
              </div>
              <span className="text-[10px] text-[var(--text-tertiary)] ml-4">
                {new Date(r.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
          {replyTo === c.id && (
            <div className="ml-4 flex items-center gap-1.5">
              <input
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSubmit() }}
                placeholder="回复..."
                className="flex-1 text-[11.5px] px-2 py-1 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-0)] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
              />
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || submitting}
                className="shrink-0 text-[var(--accent)] disabled:text-[var(--text-tertiary)]"
              >
                {submitting ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
              </button>
            </div>
          )}
        </div>
      ))}
      {/* New comment input */}
      {replyTo === null && (
        <div className="flex items-center gap-1.5 pt-1">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit() }}
            placeholder="写评论..."
            className="flex-1 text-[11.5px] px-2.5 py-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-0)] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || submitting}
            className="shrink-0 text-[var(--accent)] disabled:text-[var(--text-tertiary)]"
          >
            {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          </button>
        </div>
      )}
    </div>
  )
}
