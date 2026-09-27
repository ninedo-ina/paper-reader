"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import type { JSONContent } from "@tiptap/react"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"
import { CONTENT_CONFLICT_CODE } from "@/hooks/useAutosave"
import * as historyApi from "@/lib/api/contentVersions"
import type {
  ContentSnapshotDetailDto,
  ContentSnapshotSummaryDto,
  PaperContentDto,
} from "@/lib/api/types"
import {
  AlertTriangle,
  Camera,
  Check,
  Eye,
  GitCompare,
  History,
  Loader2,
  Pencil,
  RotateCcw,
  X,
} from "lucide-react"
import { collapseUnchanged, diffContent, type DiffLine } from "./content-diff"

/** 对比时「当前正文」那一侧的选择值。快照则用 "snapshot:<id>"。 */
const CURRENT = "current"
const SNAPSHOT_PREFIX = "snapshot:"

export interface ContentHistoryDialogProps {
  open: boolean
  onClose: () => void
  paperId: number
  /** 实时读当前正文（编辑器里的那份，含未保存改动），用于预览与对比的「当前正文」一侧 */
  getCurrentContent: () => JSONContent | null
  /** 有未保存改动时禁止回滚：回滚结果会被随后到达的自动保存盖掉 */
  dirty: boolean
  /** 回滚成功后交回覆盖后的正文，由上层同步版本号并重挂编辑器 */
  onRestored: (dto: PaperContentDto) => void
}

function isConflict(err: unknown): boolean {
  return (err as { code?: number } | null)?.code === CONTENT_CONFLICT_CODE
}

export function ContentHistoryDialog({
  open,
  onClose,
  paperId,
  getCurrentContent,
  dirty,
  onRestored,
}: ContentHistoryDialogProps) {
  const t = useTranslations("contentHistory")
  const tc = useTranslations("common")
  const locale = useLocale()

  const [snapshots, setSnapshots] = useState<ContentSnapshotSummaryDto[]>([])
  const [loading, setLoading] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)

  const [label, setLabel] = useState("")
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** 取过正文的快照缓存：预览和对比经常指向同一条，不必重复请求。 */
  const detailsRef = useRef(new Map<number, ContentSnapshotDetailDto>())
  const [previewId, setPreviewId] = useState<number | null>(null)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const [leftKey, setLeftKey] = useState(CURRENT)
  const [rightKey, setRightKey] = useState(CURRENT)
  const [diff, setDiff] = useState<{ lines: DiffLine[]; added: number; removed: number; coarse: boolean } | null>(
    null,
  )

  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [renaming, setRenaming] = useState(false)

  const [confirmRestoreId, setConfirmRestoreId] = useState<number | null>(null)
  const [restoringId, setRestoringId] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadSnapshots = useCallback(async () => {
    setLoading(true)
    setLoadFailed(false)
    try {
      const list = await historyApi.listContentSnapshots(paperId)
      setSnapshots(list)
      return list
    } catch {
      setLoadFailed(true)
      return []
    } finally {
      setLoading(false)
    }
  }, [paperId])

  // 每次打开都重新拉一遍：别的标签页可能刚存过快照。
  useEffect(() => {
    if (!open) return
    detailsRef.current = new Map()
    setPreviewId(null)
    setPreviewHtml(null)
    setDiff(null)
    setError(null)
    setNotice(null)
    setConfirmRestoreId(null)
    setLabel("")
    setLeftKey(CURRENT)
    loadSnapshots().then((list) => {
      setRightKey(list.length > 0 ? `${SNAPSHOT_PREFIX}${list[0].id}` : CURRENT)
    })
  }, [open, loadSnapshots])

  const loadDetail = useCallback(
    async (id: number): Promise<ContentSnapshotDetailDto> => {
      const cached = detailsRef.current.get(id)
      if (cached) return cached
      const detail = await historyApi.getContentSnapshot(paperId, id)
      detailsRef.current.set(id, detail)
      return detail
    },
    [paperId],
  )

  useEffect(() => {
    if (!open || previewId === null) return
    let cancelled = false
    setPreviewLoading(true)
    loadDetail(previewId)
      .then((detail) => {
        if (!cancelled) setPreviewHtml(detail.contentHtml)
      })
      .catch(() => {
        if (!cancelled) setPreviewHtml(null)
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, previewId, loadDetail])

  const sideContent = useCallback(
    async (key: string): Promise<JSONContent | null> => {
      if (key === CURRENT) return getCurrentContent()
      const id = Number(key.slice(SNAPSHOT_PREFIX.length))
      const detail = await loadDetail(id)
      return detail.contentJson
    },
    [getCurrentContent, loadDetail],
  )

  useEffect(() => {
    if (!open || leftKey === rightKey) {
      setDiff(null)
      return
    }
    let cancelled = false
    Promise.all([sideContent(leftKey), sideContent(rightKey)])
      .then(([left, right]) => {
        if (!cancelled) setDiff(diffContent(left, right))
      })
      .catch(() => {
        if (!cancelled) setDiff(null)
      })
    return () => {
      cancelled = true
    }
  }, [open, leftKey, rightKey, sideContent])

  const handleCreate = useCallback(async () => {
    setCreating(true)
    setError(null)
    setNotice(null)
    try {
      const created = await historyApi.createContentSnapshot(paperId, { label: label.trim() || null })
      setSnapshots((prev) => [created, ...prev])
      setLabel("")
      setNotice(t("snapshotCreated"))
    } catch (e) {
      setError((e as Error).message || t("snapshotCreateFailed"))
    } finally {
      setCreating(false)
    }
  }, [paperId, label, t])

  const handleRename = useCallback(
    async (id: number) => {
      setRenaming(true)
      setError(null)
      try {
        const updated = await historyApi.renameContentSnapshot(paperId, id, {
          label: renameValue.trim() || null,
        })
        setSnapshots((prev) => prev.map((s) => (s.id === id ? updated : s)))
        detailsRef.current.delete(id)
        setRenamingId(null)
      } catch (e) {
        setError((e as Error).message || t("labelSaveFailed"))
      } finally {
        setRenaming(false)
      }
    },
    [paperId, renameValue, t],
  )

  const handleRestore = useCallback(
    async (id: number) => {
      setRestoringId(id)
      setError(null)
      setNotice(null)
      try {
        const dto = await historyApi.restoreContentSnapshot(paperId, id, {})
        // 上层会把 contentVersion 记成新值并重挂编辑器，本弹层随之卸载。
        onRestored(dto)
      } catch (e) {
        setError(isConflict(e) ? t("restoreConflict") : (e as Error).message || t("restoreFailed"))
        setConfirmRestoreId(null)
      } finally {
        setRestoringId(null)
      }
    },
    [paperId, onRestored, t],
  )

  const options = useMemo(
    () => [
      { value: CURRENT, label: t("compareCurrent") },
      ...snapshots.map((s) => ({ value: `${SNAPSHOT_PREFIX}${s.id}`, label: snapshotTitle(s, t) })),
    ],
    [snapshots, t],
  )

  const visibleLines = useMemo(() => (diff ? collapseUnchanged(diff.lines) : []), [diff])

  const handleClose = useCallback(() => {
    if (creating || restoringId !== null || renaming) return
    onClose()
  }, [creating, restoringId, renaming, onClose])

  if (!open) return null

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(locale)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative glass-surface-strong rounded-xl border border-white/10 w-full max-w-4xl mx-4 p-6 shadow-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--text-primary)]">
            <History className="size-5" />
            {t("title")}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={creating || restoringId !== null}
            className="p-1 rounded-md hover:bg-[var(--surface-2)] text-[var(--text-tertiary)] disabled:opacity-40"
            aria-label={tc("cancel")}
          >
            <X className="size-5" />
          </button>
        </div>

        <p className="text-xs text-[var(--text-tertiary)] mb-3">{t("hint")}</p>

        <div className="flex items-end gap-2 mb-4">
          <div className="flex-1">
            <input
              type="text"
              value={label}
              maxLength={100}
              disabled={creating}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("labelPlaceholder")}
              aria-label={t("labelPlaceholder")}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-0)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]/40"
            />
            <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">{t("labelHint")}</p>
          </div>
          <Button type="button" size="sm" onClick={handleCreate} disabled={creating}>
            {creating ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Camera className="size-4 mr-1.5" />}
            {creating ? t("creating") : t("createSnapshot")}
          </Button>
        </div>

        {dirty && (
          <p className="flex items-center gap-1 text-xs text-amber-500 mb-3">
            <AlertTriangle className="size-3" />
            {t("dirtyHint")}
          </p>
        )}
        {notice && <p className="text-xs text-green-500 mb-3">{notice}</p>}
        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

        <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-1">
          {loading && (
            <p className="text-sm text-[var(--text-tertiary)]">{t("loading")}</p>
          )}
          {!loading && loadFailed && (
            <p className="text-sm text-red-500">{t("loadFailed")}</p>
          )}
          {!loading && !loadFailed && snapshots.length === 0 && (
            <p className="text-sm text-[var(--text-tertiary)]">{t("empty")}</p>
          )}

          {snapshots.map((snapshot) => (
            <div
              key={snapshot.id}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-0)] px-3 py-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  {snapshot.label ?? t("unnamed")}
                </span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[11px]",
                    snapshot.source === "ROLLBACK"
                      ? "bg-amber-500/10 text-amber-500"
                      : "bg-[var(--accent)]/10 text-[var(--accent)]",
                  )}
                >
                  {snapshot.source === "ROLLBACK" ? t("rollbackSource") : t("manual")}
                </span>
                <span className="text-[11px] text-[var(--text-tertiary)]">
                  {t("versionTag", { version: snapshot.contentVersion })}
                </span>
                <span className="text-[11px] text-[var(--text-tertiary)]">{formatTime(snapshot.createdAt)}</span>

                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPreviewId(previewId === snapshot.id ? null : snapshot.id)}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
                  >
                    <Eye className="size-3.5" />
                    {t("preview")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(snapshot.id)
                      setRenameValue(snapshot.label ?? "")
                    }}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
                  >
                    <Pencil className="size-3.5" />
                    {t("rename")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // 左侧固定「当前正文」，右侧放这条快照：回滚前先看清会变成什么。
                      setLeftKey(CURRENT)
                      setRightKey(`${SNAPSHOT_PREFIX}${snapshot.id}`)
                    }}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
                  >
                    <GitCompare className="size-3.5" />
                    {t("compare")}
                  </button>
                  <button
                    type="button"
                    disabled={dirty || restoringId !== null}
                    title={dirty ? t("dirtyHint") : undefined}
                    onClick={() => setConfirmRestoreId(snapshot.id)}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--accent)] hover:bg-[var(--accent)]/10 disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <RotateCcw className="size-3.5" />
                    {t("restore")}
                  </button>
                </div>
              </div>

              {renamingId === snapshot.id && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="text"
                    value={renameValue}
                    maxLength={100}
                    autoFocus
                    onChange={(e) => setRenameValue(e.target.value)}
                    placeholder={t("renamePlaceholder")}
                    aria-label={t("renamePlaceholder")}
                    className="flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--surface-0)] px-2 py-1 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]/40"
                  />
                  <Button type="button" size="sm" disabled={renaming} onClick={() => handleRename(snapshot.id)}>
                    {renaming ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                    <span className="ml-1.5">{t("renameSave")}</span>
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setRenamingId(null)}>
                    {t("renameCancel")}
                  </Button>
                </div>
              )}

              {confirmRestoreId === snapshot.id && (
                <div className="mt-2 rounded-md bg-[var(--surface-2)] px-3 py-2">
                  <p className="text-xs text-[var(--text-secondary)]">{t("restoreConfirm")}</p>
                  <div className="mt-2 flex justify-end gap-2">
                    <Button type="button" size="sm" variant="secondary" onClick={() => setConfirmRestoreId(null)}>
                      {t("renameCancel")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={restoringId !== null}
                      onClick={() => handleRestore(snapshot.id)}
                    >
                      {restoringId === snapshot.id && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
                      {restoringId === snapshot.id ? t("restoring") : t("restore")}
                    </Button>
                  </div>
                </div>
              )}

              {previewId === snapshot.id && (
                <div className="mt-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2">
                  <p className="text-[11px] text-[var(--text-tertiary)] mb-1">{t("previewTitle")}</p>
                  {previewLoading ? (
                    <p className="text-xs text-[var(--text-tertiary)]">{t("loading")}</p>
                  ) : previewHtml ? (
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none"
                      // 快照 HTML 由后端在保存时从编辑器内容渲染，与本编辑器的渲染同源
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                  ) : (
                    <p className="text-xs text-[var(--text-tertiary)]">{t("previewEmpty")}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">{t("compareTitle")}</span>
            <select
              aria-label={t("compareLeft")}
              value={leftKey}
              onChange={(e) => setLeftKey(e.target.value)}
              className="rounded-lg border border-[var(--border-color)] bg-[var(--surface-0)] px-2 py-1 text-xs text-[var(--text-primary)]"
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-[var(--text-tertiary)]">→</span>
            <select
              aria-label={t("compareRight")}
              value={rightKey}
              onChange={(e) => setRightKey(e.target.value)}
              className="rounded-lg border border-[var(--border-color)] bg-[var(--surface-0)] px-2 py-1 text-xs text-[var(--text-primary)]"
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {diff && (
              <span className="text-[11px] text-[var(--text-tertiary)]">
                {t("compareAdded", { count: diff.added })} · {t("compareRemoved", { count: diff.removed })}
              </span>
            )}
          </div>

          <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-0)] text-xs font-mono">
            {leftKey === rightKey && (
              <p className="px-3 py-2 text-[var(--text-tertiary)]">{t("comparePick")}</p>
            )}
            {leftKey !== rightKey && !diff && (
              <p className="px-3 py-2 text-[var(--text-tertiary)]">{t("loading")}</p>
            )}
            {leftKey !== rightKey && diff && diff.added === 0 && diff.removed === 0 && (
              <p className="px-3 py-2 text-[var(--text-tertiary)]">{t("compareSame")}</p>
            )}
            {leftKey !== rightKey && diff && (diff.added > 0 || diff.removed > 0) && diff.coarse && (
              <p className="px-3 py-1.5 text-[11px] text-amber-500">{t("compareCoarse")}</p>
            )}
            {leftKey !== rightKey &&
              diff &&
              (diff.added > 0 || diff.removed > 0) &&
              visibleLines.map((line, index) => (
                <div
                  key={index}
                  className={cn(
                    "whitespace-pre-wrap break-words px-3 py-0.5",
                    line.kind === "added" && "bg-green-500/10 text-green-500",
                    line.kind === "removed" && "bg-red-500/10 text-red-500",
                    line.kind === "same" && "text-[var(--text-tertiary)]",
                  )}
                >
                  {line.collapsedCount != null
                    ? t("compareCollapsed", { count: line.collapsedCount })
                    : `${line.kind === "added" ? "+" : line.kind === "removed" ? "-" : " "} ${line.text}`}
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function snapshotTitle(
  snapshot: ContentSnapshotSummaryDto,
  t: ReturnType<typeof useTranslations>,
): string {
  const name = snapshot.label ?? t("unnamed")
  return `${name} · ${t("versionTag", { version: snapshot.contentVersion })}`
}
