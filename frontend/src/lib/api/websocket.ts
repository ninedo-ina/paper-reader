import { Client, type IMessage } from "@stomp/stompjs"
import { getAccessToken } from "./client"
import type { Message, GroupMessage } from "./chat"

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080/ws"

let client: Client | null = null
const messageHandlers = new Map<string, Set<(msg: Message) => void>>()
const groupMessageHandlers = new Map<string, Set<(msg: GroupMessage) => void>>()

export function connectWebSocket(userId: number): Client {
  if (client?.active) return client

  const c = new Client({
    brokerURL: WS_URL,
    connectHeaders: {
      Authorization: `Bearer ${getAccessToken()}`,
    },
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    reconnectDelay: 5000,
  })

  c.onConnect = () => {
    c.subscribe(`/topic/chat.${userId}`, (msg: IMessage) => {
      const data = JSON.parse(msg.body) as Message
      const handlers = messageHandlers.get("private")
      handlers?.forEach((h) => h(data))
    })
    c.subscribe(`/topic/group.>`, (msg: IMessage) => {
      const data = JSON.parse(msg.body) as GroupMessage
      const handlers = groupMessageHandlers.get(`group:${data.groupId}`)
      handlers?.forEach((h) => h(data))
    })
  }

  c.activate()
  client = c
  return c
}

export function disconnectWebSocket() {
  client?.deactivate()
  client = null
}

export function getStompClient(): Client | null {
  return client
}

export function sendPrivateMessage(senderId: number, receiverId: number, content: string) {
  client?.publish({
    destination: "/app/chat.private",
    body: JSON.stringify({ senderId, receiverId, content }),
  })
}

export function sendGroupMessage(groupId: number, senderId: number, content: string) {
  client?.publish({
    destination: "/app/chat.group",
    body: JSON.stringify({ groupId, senderId, content }),
  })
}

export function onPrivateMessage(handler: (msg: Message) => void) {
  if (!messageHandlers.has("private")) {
    messageHandlers.set("private", new Set())
  }
  messageHandlers.get("private")!.add(handler)
  return () => {
    messageHandlers.get("private")?.delete(handler)
  }
}

export function onGroupMessage(groupId: number, handler: (msg: GroupMessage) => void) {
  const key = `group:${groupId}`
  if (!groupMessageHandlers.has(key)) {
    groupMessageHandlers.set(key, new Set())
  }
  groupMessageHandlers.get(key)!.add(handler)
  return () => {
    groupMessageHandlers.get(key)?.delete(handler)
  }
}
