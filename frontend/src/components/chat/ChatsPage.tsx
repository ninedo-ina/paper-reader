"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { useUserStore } from "@/stores/user-store"
import { useImStore } from "@/stores/im-store"
import { PrivateChatList } from "./PrivateChatList"
import { GroupChatList } from "./GroupChatList"
import { ChatWindow } from "./ChatWindow"
import { MessageSquare, Users } from "lucide-react"

type MainTab = "private" | "group"

export function ChatsPage() {
  const tc = useTranslations("chat")
  const profile = useUserStore((s) => s.profile)
  const clientId = useImStore((s) => s.clientId)
  const connect = useImStore((s) => s.connect)
  const disconnect = useImStore((s) => s.disconnect)
  const activeChat = useImStore((s) => s.activeChat)
  const setActiveView = useImStore((s) => s.setActiveView)

  const [mainTab, setMainTab] = useState<MainTab>("private")

  useEffect(() => {
    if (profile?.id && !clientId) {
      connect(profile.id)
    }
    return () => {
      disconnect()
    }
  }, [profile?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (tab: MainTab) => {
    setMainTab(tab)
    setActiveView("list")
  }

  return (
    <div className="flex h-full bg-white dark:bg-zinc-900">
      {/* Left sidebar */}
      <div className="w-80 border-r border-zinc-200 dark:border-zinc-800 flex flex-col shrink-0">
        {/* Top tabs: Private / Group */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => handleTabChange("private")}
            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium cursor-pointer transition-colors ${
              mainTab === "private"
                ? "border-b-2 border-zinc-800 dark:border-zinc-200 text-zinc-800 dark:text-zinc-200"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            <MessageSquare size={16} />
            {tc("privateMessages")}
          </button>
          <button
            onClick={() => handleTabChange("group")}
            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium cursor-pointer transition-colors ${
              mainTab === "group"
                ? "border-b-2 border-zinc-800 dark:border-zinc-200 text-zinc-800 dark:text-zinc-200"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            <Users size={16} />
            {tc("groupChats")}
          </button>
        </div>

        {/* Contact/Group list */}
        <div className="flex-1 overflow-y-auto">
          {mainTab === "private" ? <PrivateChatList /> : <GroupChatList />}
        </div>
      </div>

      {/* Right — Chat window or placeholder */}
      <div className="flex-1 flex flex-col">
        {activeChat ? (
          <ChatWindow />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-zinc-400 dark:text-zinc-500 text-sm">
              {tc("selectChat")}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
