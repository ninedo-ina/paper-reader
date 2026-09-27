"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import type { JSONContent } from "@tiptap/react"
import * as Y from "yjs"
import { IndexeddbPersistence } from "y-indexeddb"
import { MessageSquare, Users, Wifi, WifiOff } from "lucide-react"
import { PaperEditor } from "@/components/papers/PaperEditor/PaperEditor"
import type { PaperContentPayload, CollabConfig } from "@/components/papers/PaperEditor/PaperEditor"
import { CommentsSidebar } from "@/components/papers/CommentsSidebar"
import { CollabPanel } from "@/components/papers/CollabPanel"
import { StompYjsProvider } from "@/lib/collab/stompYjsProvider"
import { base64ToBytes, bytesToBase64 } from "@/lib/collab/encoding"
import { getCollabState, saveCollabState } from "@/lib/api/collab"
import { getPaperContent } from "@/lib/api/papers"
import type { PaperDetailDto, UserProfile } from "@/lib/api/types"

// 光标颜色：从 userId 派生，保证同一用户每次进来都是同一种颜色。
const CARET_COLORS = ["#f43f5e", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"]
function colorForUser(id: number): string {
  return CARET_COLORS[Math.abs(id) % CARET_COLORS.length]
}

interface CollabReady {
  doc: Y.Doc
  collab: CollabConfig
}

type Phase =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; ready: CollabReady; canWrite: boolean; isOwner: boolean }

/**
 * 实时协作编辑外壳（W7）。只在「已登录 + 手写论文」时挂载，负责把 Yjs 文档、
 * IndexedDB 离线缓存、STOMP 中继和权限一次性装配好，再交给 PaperEditor 渲染。
 *
 *  - 文档身份：先取服务端全量快照（顺带拿到本人角色），本地 IndexedDB 回灌离线改动后叠加快照；
 *  - 权限：canWrite=false（VIEWER/导师）只读，不给 onSave，但仍可在右侧批注；
 *  - 播种：仅作者且服务端尚无快照时，用既有正文首次播种（PaperEditor 内 setContent + 立即保存）。
 */
export function CollaborativeEditor({ paper, profile }: { paper: PaperDetailDto; profile: UserProfile }) {
  const t = useTranslations("papers")
  const paperId = paper.id

  const [phase, setPhase] = useState<Phase>({ kind: "loading" })
  const [connected, setConnected] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [showPanel, setShowPanel] = useState(false)

  useEffect(() => {
    let cancelled = false
    let doc: Y.Doc | null = null
    let idb: IndexeddbPersistence | null = null
    let provider: StompYjsProvider | null = null

    async function setup() {
      try {
        const stateDto = await getCollabState(paperId)
        // 仅作者、且服务端还没有任何快照时，取既有正文作首次播种；读不到就当空文档，绝不覆盖别人。
        let seedContent: JSONContent | null = null
        if (stateDto.isOwner && stateDto.state == null) {
          seedContent = await getPaperContent(paperId)
            .then((d) => d.contentJson)
            .catch(() => null)
        }
        if (cancelled) return

        doc = new Y.Doc()
        idb = new IndexeddbPersistence(`pr-collab-${paperId}`, doc)
        // 等本地离线数据回灌完，再叠加服务端快照——两边都走 CRDT 合并，先后顺序不影响收敛。
        await idb.whenSynced.catch(() => {})
        if (cancelled) return
        if (stateDto.state) {
          Y.applyUpdate(doc, base64ToBytes(stateDto.state), "server")
        }

        provider = new StompYjsProvider(paperId, doc, {
          onStatusChange: (c) => {
            if (!cancelled) setConnected(c)
          },
        })

        const collab: CollabConfig = {
          doc,
          provider,
          user: { name: profile.displayName || profile.email, color: colorForUser(profile.id) },
          canWrite: stateDto.canWrite,
          seedContent,
        }
        setPhase({ kind: "ready", ready: { doc, collab }, canWrite: stateDto.canWrite, isOwner: stateDto.isOwner })
      } catch {
        if (!cancelled) setPhase({ kind: "error" })
      }
    }
    void setup()

    return () => {
      cancelled = true
      // 顺序：先停中继，再断本地缓存与文档，避免销毁后仍有更新回调进来。
      provider?.destroy()
      void idb?.destroy()
      doc?.destroy()
    }
    // 换论文或换人才重建协作会话；显示名/颜色在装配时定格，中途改名下次挂载生效。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperId, profile.id])

  // 保存动作绑定当前 doc：把整份 Yjs 快照 + 派生正文一起落库（LWW），只有可写者才给。
  const handleSave = useMemo(() => {
    if (phase.kind !== "ready" || !phase.canWrite) return undefined
    const { doc } = phase.ready
    return async (payload: PaperContentPayload) => {
      await saveCollabState(paperId, {
        state: bytesToBase64(Y.encodeStateAsUpdate(doc)),
        contentJson: payload.contentJson,
        contentHtml: payload.contentHtml,
      })
    }
  }, [phase, paperId])

  const closePanel = useCallback(() => setShowPanel(false), [])
  const closeComments = useCallback(() => setShowComments(false), [])

  if (phase.kind === "loading") {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: "var(--bg-root)" }}>
        <p className="text-sm text-[var(--text-tertiary)]">{t("collabConnecting")}</p>
      </div>
    )
  }

  if (phase.kind === "error") {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: "var(--bg-root)" }}>
        <p className="text-sm text-[var(--text-tertiary)]">{t("collabLoadFailed")}</p>
      </div>
    )
  }

  const { collab, isOwner } = { collab: phase.ready.collab, isOwner: phase.isOwner }

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: "var(--bg-root)" }}>
      <div className="flex items-center justify-end gap-2 px-4 py-1.5 border-b border-[var(--border-subtle)] glass-surface">
        <span
          className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]"
          title={connected ? t("collabOnline") : t("collabOffline")}
        >
          {connected ? <Wifi className="size-3.5 text-green-500" /> : <WifiOff className="size-3.5 text-amber-500" />}
          {connected ? t("collabOnline") : t("collabOffline")}
        </span>
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-[var(--surface-2)] ${showComments ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"}`}
        >
          <MessageSquare className="size-3.5" />
          {t("comments")}
        </button>
        {isOwner && (
          <button
            type="button"
            onClick={() => setShowPanel(true)}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
          >
            <Users className="size-3.5" />
            {t("manageCollab")}
          </button>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 flex flex-col">
          <PaperEditor paper={paper} content={null} onSave={handleSave} collab={collab} />
        </div>
        {showComments && (
          <div className="w-80 shrink-0 border-l border-[var(--border-subtle)] overflow-hidden">
            <CommentsSidebar
              paperId={paperId}
              meId={profile.id}
              canWrite={phase.canWrite}
              isOwner={isOwner}
              onClose={closeComments}
            />
          </div>
        )}
      </div>

      {showPanel && isOwner && <CollabPanel paperId={paperId} onClose={closePanel} />}
    </div>
  )
}
