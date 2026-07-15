"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslations } from "next-intl"
import { Plus, MessageCircle, ThumbsUp, Star, ChevronRight, ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToastStore } from "@/stores/toast-store"
import * as forumApi from "@/lib/api/forum"
import type { Discipline, Topic } from "@/lib/api/forum"
import type { Post, PostDetail } from "@/lib/api/forum"
import { PostDetailView } from "./PostDetail"

export function ForumPage() {
  const tf = useTranslations("forum")
  const tc = useTranslations("common")

  const addToast = useToastStore((s) => s.addToast)

  const [disciplines, setDisciplines] = useState<Discipline[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [selectedDiscipline, setSelectedDiscipline] = useState<Discipline | null>(null)
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null)
  const [selectedPost, setSelectedPost] = useState<PostDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [postsLoading, setPostsLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [totalPosts, setTotalPosts] = useState(0)
  const [showComposer, setShowComposer] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    forumApi.getDisciplines()
      .then(setDisciplines)
      .catch(() => addToast({ message: tc("error"), type: "error" }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectDiscipline = useCallback((d: Discipline) => {
    setSelectedDiscipline(d)
    setSelectedTopic(null)
    setPosts([])
    setPage(0)
    setLoading(true)
    forumApi.getTopics(d.id)
      .then(setTopics)
      .catch(() => addToast({ message: tc("error"), type: "error" }))
      .finally(() => setLoading(false))
  }, [addToast, tc])

  const handleSelectTopic = useCallback((t: Topic) => {
    setSelectedTopic(t)
    setPosts([])
    setPage(0)
    setPostsLoading(true)
    forumApi.getPosts(t.id, 0)
      .then((res) => {
        setPosts(res.items)
        setTotalPosts(res.total)
      })
      .catch(() => addToast({ message: tc("error"), type: "error" }))
      .finally(() => setPostsLoading(false))
  }, [addToast, tc])

  const handleLoadMore = useCallback(() => {
    if (!selectedTopic) return
    const nextPage = page + 1
    setPostsLoading(true)
    forumApi.getPosts(selectedTopic.id, nextPage)
      .then((res) => {
        setPosts((prev) => [...prev, ...res.items])
        setPage(nextPage)
      })
      .catch(() => addToast({ message: tc("error"), type: "error" }))
      .finally(() => setPostsLoading(false))
  }, [selectedTopic, page, addToast, tc])

  const handleCreatePost = useCallback(async () => {
    if (!selectedTopic || !title.trim() || !content.trim()) return
    setSubmitting(true)
    try {
      const post = await forumApi.createPost(selectedTopic.id, title.trim(), content.trim())
      setPosts((prev) => [post, ...prev])
      setTotalPosts((n) => n + 1)
      setShowComposer(false)
      setTitle("")
      setContent("")
    } catch {
      addToast({ message: tc("error"), type: "error" })
    } finally {
      setSubmitting(false)
    }
  }, [selectedTopic, title, content, addToast, tc])

  const handleSelectPost = useCallback((post: Post) => {
    setLoading(true)
    forumApi.getPostDetail(post.id)
      .then(setSelectedPost)
      .catch(() => addToast({ message: tc("error"), type: "error" }))
      .finally(() => setLoading(false))
  }, [addToast, tc])

  // Post detail view
  if (selectedPost) {
    return (
      <PostDetailView
        post={selectedPost}
        onBack={() => setSelectedPost(null)}
        onUpdate={(updated) => setSelectedPost(updated)}
      />
    )
  }

  const hasMore = posts.length < totalPosts

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left: Discipline sidebar */}
      <div className="w-48 border-r border-[var(--border-subtle)] flex flex-col shrink-0" style={{ background: "var(--surface-1)" }}>
        <div className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.6px] text-[var(--text-tertiary)]">
          {tf("disciplines")}
        </div>
        <div className="flex-1 overflow-y-auto">
          {disciplines.map((d) => (
            <button
              key={d.id}
              onClick={() => handleSelectDiscipline(d)}
              className={cn(
                "w-full text-left px-3 py-2 text-[13.5px] transition-colors",
                "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
                selectedDiscipline?.id === d.id && "bg-[var(--bg-active)] text-[var(--text-primary)] font-[550]",
              )}
            >
              {d.name}
            </button>
          ))}
          {disciplines.length === 0 && (
            <div className="px-3 py-2 text-[13px] text-[var(--text-tertiary)]">{tc("loading")}</div>
          )}
        </div>
      </div>

      {/* Middle: Topic tabs + Post list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topic tabs */}
        {selectedDiscipline && (
          <div className="border-b border-[var(--border-subtle)] px-4 py-2 flex items-center gap-2" style={{ background: "var(--surface-1)" }}>
            {topics.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelectTopic(t)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[13px] transition-colors",
                  "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
                  selectedTopic?.id === t.id && "bg-[var(--accent)]/10 text-[var(--accent)] font-[550]",
                )}
              >
                {t.name}
              </button>
            ))}
            {loading && <span className="text-[12px] text-[var(--text-tertiary)]">{tc("loading")}</span>}
          </div>
        )}

        {/* Post list */}
        <div className="flex-1 overflow-y-auto">
          {!selectedDiscipline && (
            <div className="flex items-center justify-center h-full text-[var(--text-tertiary)] text-[14px]">
              {tf("selectDiscipline")}
            </div>
          )}
          {selectedDiscipline && !selectedTopic && (
            <div className="flex items-center justify-center h-full text-[var(--text-tertiary)] text-[14px]">
              {!loading && tf("selectTopic")}
            </div>
          )}
          {selectedTopic && (
            <>
              {/* Create post button */}
              <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
                {showComposer ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={tf("postTitlePlaceholder")}
                      className="w-full bg-transparent border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
                    />
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder={tf("postContentPlaceholder")}
                      rows={3}
                      className="w-full bg-transparent border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] resize-none"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setShowComposer(false)}
                        className="px-3 py-1.5 rounded-lg text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                      >
                        {tc("cancel")}
                      </button>
                      <button
                        onClick={handleCreatePost}
                        disabled={submitting || !title.trim() || !content.trim()}
                        className="px-4 py-1.5 rounded-lg text-[13px] font-medium bg-[var(--accent)] text-[var(--surface-1)] hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {submitting ? tf("publishing") : tf("publish")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowComposer(true)}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-xl border border-dashed border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:border-[var(--text-secondary)] transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-[13px]">{tf("createPost")}</span>
                  </button>
                )}
              </div>

              {/* Posts */}
              {postsLoading && posts.length === 0 && (
                <div className="flex items-center justify-center py-12 text-[var(--text-tertiary)] text-[14px]">
                  {tc("loading")}
                </div>
              )}
              {!postsLoading && posts.length === 0 && (
                <div className="flex items-center justify-center py-12 text-[var(--text-tertiary)] text-[14px]">
                  {tf("noPosts")}
                </div>
              )}
              {posts.map((post) => (
                <button
                  key={post.id}
                  onClick={() => handleSelectPost(post)}
                  className="w-full text-left px-4 py-3 border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--accent)]/10 flex items-center justify-center shrink-0 text-[12px] font-semibold text-[var(--accent)]">
                      {post.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium text-[var(--text-primary)] truncate">{post.title}</div>
                      <div className="text-[12px] text-[var(--text-tertiary)] mt-1 line-clamp-2">
                        {post.content}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-[11px] text-[var(--text-tertiary)]">
                        <span>{post.username}</span>
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="w-3 h-3" />
                          {post.likeCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          {post.commentCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3" />
                          {post.favoriteCount}
                        </span>
                        <span>{formatTime(post.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              {hasMore && (
                <div className="flex justify-center py-4">
                  <button
                    onClick={handleLoadMore}
                    disabled={postsLoading}
                    className="px-4 py-2 rounded-lg text-[13px] text-[var(--accent)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
                  >
                    {postsLoading ? tc("loading") : tf("loadMore")}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
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
