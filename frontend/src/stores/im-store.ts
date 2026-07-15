import { create } from "zustand"
import * as chatApi from "@/lib/api/chat"
import type { Contact, Message, GroupInfo, GroupMessage } from "@/lib/api/chat"
import {
  connectWebSocket,
  disconnectWebSocket,
  sendPrivateMessage,
  sendGroupMessage,
  onPrivateMessage,
} from "@/lib/api/websocket"

export type ChatTab = "recent" | "friends"
export type ChatView = "list" | "private" | "group"

interface ImState {
  clientId: number | null
  activeView: ChatView
  chatTab: ChatTab

  recentContacts: Contact[]
  friends: Contact[]
  groups: GroupInfo[]
  isContactsLoading: boolean

  activeChat: { type: "private"; target: Contact } | { type: "group"; groupId: number; name: string } | null
  messages: (Message | GroupMessage)[]
  isMessagesLoading: boolean

  connect: (userId: number) => void
  disconnect: () => void

  loadRecentContacts: () => Promise<void>
  loadFriends: () => Promise<void>
  loadGroups: () => Promise<void>
  setChatTab: (tab: ChatTab) => void
  setActiveView: (view: ChatView) => void

  openPrivateChat: (contact: Contact) => void
  openGroupChat: (groupId: number, name: string) => void
  loadMessages: (targetId: number) => Promise<void>
  loadGroupMessages: (groupId: number) => Promise<void>

  sendMessage: (content: string) => void
  toggleFollow: (userId: number) => Promise<void>

  addIncomingMessage: (msg: Message) => void
  addIncomingGroupMessage: (msg: GroupMessage) => void
}

export const useImStore = create<ImState>((set, get) => ({
  clientId: null,
  activeView: "list",
  chatTab: "recent",

  recentContacts: [],
  friends: [],
  groups: [],
  isContactsLoading: false,

  activeChat: null,
  messages: [],
  isMessagesLoading: false,

  connect: (userId: number) => {
    set({ clientId: userId })
    connectWebSocket(userId)
    onPrivateMessage((msg) => {
      get().addIncomingMessage(msg)
    })
    get().loadRecentContacts()
    get().loadGroups()
  },

  disconnect: () => {
    disconnectWebSocket()
    set({ clientId: null })
  },

  loadRecentContacts: async () => {
    set({ isContactsLoading: true })
    try {
      const contacts = await chatApi.getRecentContacts()
      set({ recentContacts: contacts })
    } catch { /* empty */ }
    set({ isContactsLoading: false })
  },

  loadFriends: async () => {
    set({ isContactsLoading: true })
    try {
      const friends = await chatApi.getFriends()
      set({ friends })
    } catch { /* empty */ }
    set({ isContactsLoading: false })
  },

  loadGroups: async () => {
    try {
      const groups = await chatApi.getGroups()
      set({ groups })
    } catch { /* empty */ }
  },

  setChatTab: (tab) => set({ chatTab: tab }),

  setActiveView: (view) => set({ activeView: view }),

  openPrivateChat: (contact) => {
    set({ activeChat: { type: "private", target: contact }, activeView: "private" })
    get().loadMessages(contact.id)
  },

  openGroupChat: (groupId, name) => {
    set({ activeChat: { type: "group", groupId, name }, activeView: "group" })
    get().loadGroupMessages(groupId)
  },

  loadMessages: async (targetId) => {
    set({ isMessagesLoading: true })
    try {
      const page = await chatApi.getMessages(targetId)
      set({ messages: page.items })
    } catch { /* empty */ }
    set({ isMessagesLoading: false })
  },

  loadGroupMessages: async (groupId) => {
    set({ isMessagesLoading: true })
    try {
      const page = await chatApi.getGroupMessages(groupId)
      set({ messages: page.items })
    } catch { /* empty */ }
    set({ isMessagesLoading: false })
  },

  sendMessage: (content) => {
    const { activeChat, clientId } = get()
    if (!clientId || !content.trim()) return
    if (!activeChat) return

    if (activeChat.type === "private") {
      sendPrivateMessage(clientId, activeChat.target.id, content)
    } else {
      sendGroupMessage(activeChat.groupId, clientId, content)
    }
  },

  toggleFollow: async (userId) => {
    await chatApi.followUser(userId)
    get().loadFriends()
  },

  addIncomingMessage: (msg) => {
    const { activeChat } = get()
    set((s) => {
      if (
        activeChat?.type === "private" &&
        (activeChat.target.id === msg.senderId || activeChat.target.id === msg.receiverId)
      ) {
        return { messages: [...s.messages, msg] }
      }
      return {}
    })
    get().loadRecentContacts()
  },

  addIncomingGroupMessage: (msg) => {
    const { activeChat } = get()
    set((s) => {
      if (activeChat?.type === "group" && activeChat.groupId === msg.groupId) {
        return { messages: [...s.messages, msg] }
      }
      return {}
    })
  },
}))
