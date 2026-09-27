"use client"

import { Client } from "@stomp/stompjs"
import * as Y from "yjs"
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness"
import { getAccessToken } from "@/lib/api/client"
import { base64ToBytes, bytesToBase64 } from "./encoding"

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080/ws"

interface RelayPayload {
  update: string
  origin?: string | null
}

export interface StompYjsProviderOptions {
  onStatusChange?: (connected: boolean) => void
}

/**
 * 把 Yjs 文档架在既有的 Spring STOMP `/ws` 上：本地更新 → /app/collab/{id}/update，
 * 服务端不透明中继回 /topic/collab/{id}；awareness（光标/在场）走并行的一对目的地。
 * 连接鉴权与订阅授权由 StompAuthChannelInterceptor 按论文 ACL 把关（验收③）。
 */
export class StompYjsProvider {
  readonly doc: Y.Doc
  readonly awareness: Awareness
  private readonly client: Client
  private readonly paperId: number
  private readonly clientId: number
  /** 中继信封里的发送方标识。用字符串是为了和后端 origin: String? 对齐——
   *  经 JSON 往返后 `"12345" === "12345"` 才成立，数字会被 Jackson 强转成字符串而对不上，自身回声就滤不掉。 */
  private readonly originId: string
  private readonly onStatusChange?: (connected: boolean) => void
  /** 已补发过全量状态的对端 clientID，避免 awareness 每次抖动都重发。 */
  private synced = new Set<number>()
  private destroyed = false

  constructor(paperId: number, doc: Y.Doc, options: StompYjsProviderOptions = {}) {
    this.doc = doc
    this.paperId = paperId
    this.clientId = doc.clientID
    this.originId = String(doc.clientID)
    this.awareness = new Awareness(doc)
    this.onStatusChange = options.onStatusChange

    this.doc.on("update", this.handleDocUpdate)
    this.awareness.on("update", this.handleAwarenessUpdate)
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", this.handleUnload)
    }

    this.client = new Client({
      brokerURL: WS_URL,
      connectHeaders: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      reconnectDelay: 5000,
      beforeConnect: () => {
        // 每次（重）连都取当前 token，避免刷新后仍带着过期票据连。
        this.client.connectHeaders = { Authorization: `Bearer ${getAccessToken() ?? ""}` }
      },
    })
    this.client.onConnect = this.onConnect
    this.client.onWebSocketClose = () => this.onStatusChange?.(false)
    this.client.activate()
  }

  private get updateDest() { return `/app/collab/${this.paperId}/update` }
  private get awarenessDest() { return `/app/collab/${this.paperId}/awareness` }
  private get updateTopic() { return `/topic/collab/${this.paperId}` }
  private get awarenessTopic() { return `/topic/collab/${this.paperId}/awareness` }
  private onConnect = () => {
    this.synced.clear()
    this.client.subscribe(this.updateTopic, (msg) => this.onUpdateMessage(msg.body))
    this.client.subscribe(this.awarenessTopic, (msg) => this.onAwarenessMessage(msg.body))
    // 把本地全量状态推给在场对端；重连时这一步会补齐离线期间的改动（验收②）。
    this.publishUpdate(Y.encodeStateAsUpdate(this.doc))
    // 宣告在场，触发对端把它们的在途状态补发给我们。
    this.publishAwareness([this.clientId])
    this.onStatusChange?.(true)
  }

  private handleDocUpdate = (update: Uint8Array, origin: unknown) => {
    // origin === this 表示这是我们 applyUpdate 远端消息产生的回声，不再外发，避免回环。
    if (origin === this) return
    this.publishUpdate(update)
  }

  private handleAwarenessUpdate = (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (origin === "remote") {
      // 有新对端出现 → 把全量文档状态和自己的在场补发过去（每个对端只补一次）。
      const fresh = changes.added.filter((id) => id !== this.clientId && !this.synced.has(id))
      if (fresh.length > 0) {
        fresh.forEach((id) => this.synced.add(id))
        this.publishUpdate(Y.encodeStateAsUpdate(this.doc))
        this.publishAwareness([this.clientId])
      }
      return
    }
    // 本地 awareness 变化（光标/在场）→ 广播给对端。
    this.publishAwareness([...changes.added, ...changes.updated, ...changes.removed])
  }

  private onUpdateMessage(body: string) {
    const payload = JSON.parse(body) as RelayPayload
    if (payload.origin === this.originId) return // 自己的回声
    Y.applyUpdate(this.doc, base64ToBytes(payload.update), this)
  }

  private onAwarenessMessage(body: string) {
    const payload = JSON.parse(body) as RelayPayload
    if (payload.origin === this.originId) return
    applyAwarenessUpdate(this.awareness, base64ToBytes(payload.update), "remote")
  }
  private publishUpdate(update: Uint8Array) {
    if (!this.client.connected) return
    this.client.publish({
      destination: this.updateDest,
      body: JSON.stringify({ update: bytesToBase64(update), origin: this.originId } satisfies RelayPayload),
    })
  }

  private publishAwareness(clients: number[]) {
    if (!this.client.connected || clients.length === 0) return
    const update = encodeAwarenessUpdate(this.awareness, clients)
    this.client.publish({
      destination: this.awarenessDest,
      body: JSON.stringify({ update: bytesToBase64(update), origin: this.originId } satisfies RelayPayload),
    })
  }

  private handleUnload = () => {
    removeAwarenessStates(this.awareness, [this.clientId], "unload")
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    if (typeof window !== "undefined") window.removeEventListener("beforeunload", this.handleUnload)
    this.doc.off("update", this.handleDocUpdate)
    this.awareness.off("update", this.handleAwarenessUpdate)
    removeAwarenessStates(this.awareness, [this.clientId], "destroy")
    this.awareness.destroy()
    void this.client.deactivate()
  }
}
