import { create } from "zustand"

export interface NotificationItem {
  id: string
  type: "system" | "app"
  title: string
  message: string
  timestamp: number
  read: boolean
  actionKey?: string
}

interface NotificationState {
  notifications: NotificationItem[]
  showVersionPopup: boolean

  unreadCount: () => number
  addNotification: (n: Omit<NotificationItem, "timestamp" | "read">) => void
  markRead: (id: string) => void
  markAllRead: (type?: "system" | "app") => void
  removeNotification: (id: string) => void
  setShowVersionPopup: (show: boolean) => void
  initSystemNotifications: () => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  showVersionPopup: false,

  unreadCount: () => get().notifications.filter((n) => !n.read).length,

  addNotification: (n) =>
    set((s) => ({
      notifications: [
        { ...n, timestamp: Date.now(), read: false },
        ...s.notifications,
      ],
    })),

  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      ),
    })),

  markAllRead: (type) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        type ? (n.type === type ? { ...n, read: true } : n) : { ...n, read: true },
      ),
    })),

  removeNotification: (id) =>
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    })),

  setShowVersionPopup: (show) => set({ showVersionPopup: show }),

  initSystemNotifications: () => {
    const { notifications } = get()
    if (!notifications.some((n) => n.id === "version-info")) {
      get().addNotification({
        id: "version-info",
        type: "system",
        title: "系统功能介绍",
        message: "欢迎使用 Paper Reader！点击查看当前版本功能特性",
        actionKey: "version",
      })
    }
  },
}))
