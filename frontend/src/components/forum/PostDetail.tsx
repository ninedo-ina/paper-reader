"use client"

import { useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { ArrowLeft, ThumbsUp, Star, MessageCircle, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUserStore } from "@/stores/user-store"
import { useToastStore } from "@/stores/toast-store"
import * as forumApi from "@/lib/api/forum"
import type { PostDetail as PostDetailType, Comment } from "@/lib/api/forum"

interface Props {
  post: PostDetailType
  onBack: () => void
  onUpdate: (post: PostDetailType) => void
}

export function PostDetailView({ post, onBack, onUpdate }: Props) {
  const tf = useTranslations("forum")
  const tc = useTranslations("common")
  const profile = useUserStore((s) => s.profile)
  const addToast = useToastStore((s) => s.addToast)
  const [replyContent, setReplyContent] = useState("")
  const [replying, setReplying] = useState(false)

  const handleToggleLike = useCallback(async () => {
    try {
      await forumApi.toggleLike(post.id)
      onUpdate({
        ...post,
        liked: !post.liked,
        likeCount: post.liked ? post.likeCount - 1 : post.likeCount + 1,
      })
    } catch {
      addToast({ message: tc("error"), type: "error" })
    }
  }, [post, onUpdate, addToast, tc])

  const handleToggleFavorite = useCallback(async () => {
    try {
      await forumApi.toggleFavorite(post.id)
      onUpdate({
        ...post,
        favorited: !post.favorited,
        favoriteCount: post.favorited ? post.favoriteCount - 1 : post.favoriteCount + 1,
      })
    } catch {
      addToast({ message: tc("error"), type: "error" })
    }
  }, [post, onUpdate, addToast, tc])

  const handleReply = useCallback(async () => {
    if (!replyContent.trim()) return
    setReplying(true)
    try {
      const comment = await forumApi.createComment(post.id, replyContent.trim())
      onUpdate({
        ...post,
        comments: [...post.comments, comment],
        commentCount: post.commentCount + 1,
      })
      setReplyContent("")
    } catch {
      addToast({ message: tc("error"), type: "error" })
    } finally {
      setReplying(false)
    }
  }, [post, replyContent, onUpdate, addToast, tc])

  const handleDelete = useCallback(async () => {
    if (!confirm(tf("deleteConfirm"))) return
    try {
      await forumApi.deletePost(post.id)
      onBack()
    } catch {
      addToast({ message: tc("error"), type: "error" })
    }
  }, [post.id, onBack, addToast, tf, tc])

  const isOwner = profile?.id === post.userId

  // Build comment tree
  const topLevelComments = post.comments.filter((c) => !c.parentId)
  const repliesByParent = new Map<number, Comment[]>()
  for (const c of post.comments) {
    if (c.parentId) {
      const arr = repliesByParent.get(c.parentId) || []
      arr.push(c)
      repliesByParent.set(c.parentId, arr)
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-subtle)]" style={{ background: "var(--surface-1)" }}>
        <button
          onClick={onBack}
          className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-[12px] text-[var(--text-tertiary)]">{tf("back")}</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Post body */}
        <div className="px-4 py-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--accent)]/10 flex items-center justify-center shrink-0 text-[14px] font-semibold text-[var(--accent)]">
              {post.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-[17px] font-semibold text-[var(--text-primary)]">{post.title}</h1>
              <div className="flex items-center gap-2 mt-1 text-[12px] text-[var(--text-tertiary)]">
                <span>{post.username}</span>
                <span>{formatTime(post.createdAt)}</span>
                {isOwner && (
                  <button
                    onClick={handleDelete}
                    className="p-0.5 rounded hover:text-red-500 hover:bg-red-50 transition-colors ml-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="mt-4 text-[14px] text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
                {post.content}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-4 mt-5 pt-4 border-t border-[var(--border-subtle)]">
                <button
                  onClick={handleToggleLike}
                  className={cn(
                    "flex items-center gap-1.5 text-[13px] transition-colors",
                    post.liked
                      ? "text-[var(--accent)]"
                      : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]",
                  )}
                >
                  <ThumbsUp className="w-4 h-4" fill={post.liked ? "currentColor" : "none"} />
                  {post.likeCount > 0 && <span>{post.likeCount}</span>}
                </button>
                <button
                  onClick={handleToggleFavorite}
                  className={cn(
                    "flex items-center gap-1.5 text-[13px] transition-colors",
                    post.favorited
                      ? "text-amber-500"
                      : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]",
                  )}
                >
                  <Star className="w-4 h-4" fill={post.favorited ? "currentColor" : "none"} />
                  {post.favoriteCount > 0 && <span>{post.favoriteCount}</span>}
                </button>
                <div className="flex items-center gap-1.5 text-[13px] text-[var(--text-tertiary)]">
                  <MessageCircle className="w-4 h-4" />
                  {post.commentCount > 0 && <span>{post.commentCount}</span>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Comments section */}
        <div className="border-t border-[var(--border-subtle)]">
          <div className="px-4 py-3 text-[13px] font-semibold text-[var(--text-secondary)]">
            {post.comments.length > 0 ? `${post.comments.length} 条评论` : tf("noComments")}
          </div>

          {/* New reply input */}
          <div className="px-4 pb-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder={tf("replyPlaceholder")}
                className="flex-1 bg-transparent border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleReply()
                  }
                }}
              />
              <button
                onClick={handleReply}
                disabled={replying || !replyContent.trim()}
                className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--accent)] text-[var(--surface-1)] hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
              >
                {replying ? tc("loading") : tf("submitReply")}
              </button>
            </div>
          </div>

          {/* Comment list */}
          <div className="px-4 pb-4 space-y-3">
            {topLevelComments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                replies={repliesByParent.get(comment.id) || []}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function CommentItem({ comment, replies }: { comment: Comment; replies: Comment[] }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-7 h-7 rounded-full bg-[var(--accent)]/10 flex items-center justify-center shrink-0 text-[11px] font-semibold text-[var(--accent)]">
        {comment.username.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-[var(--text-secondary)]">{comment.username}</span>
          <span className="text-[11px] text-[var(--text-tertiary)]">{formatTime(comment.createdAt)}</span>
        </div>
        <div className="mt-0.5 text-[13px] text-[var(--text-primary)]">{comment.content}</div>
        {replies.length > 0 && (
          <div className="mt-2 pl-2 border-l-2 border-[var(--border-subtle)] space-y-2">
            {replies.map((r) => (
              <CommentItem key={r.id} comment={r} replies={[]} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "刚刚"
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  return d.toLocaleDateString("zh-CN")
}
