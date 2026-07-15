"use client"

import { useEffect } from "react"
import { useTranslations } from "next-intl"
import { useImStore } from "@/stores/im-store"
import { Clock, Users } from "lucide-react"

export function PrivateChatList() {
  const tc = useTranslations("chat")
  const tcCommon = useTranslations("common")
  const chatTab = useImStore((s) => s.chatTab)
  const setChatTab = useImStore((s) => s.setChatTab)
  const recentContacts = useImStore((s) => s.recentContacts)
  const friends = useImStore((s) => s.friends)
  const isContactsLoading = useImStore((s) => s.isContactsLoading)
  const loadFriends = useImStore((s) => s.loadFriends)
  const openPrivateChat = useImStore((s) => s.openPrivateChat)

  useEffect(() => {
    if (chatTab === "friends") {
      loadFriends()
    }
  }, [chatTab, loadFriends])

  const contacts = chatTab === "recent" ? recentContacts : friends

  return (
    <div className="flex flex-col h-full">
      {/* Sub tabs: Recent / Friends */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setChatTab("recent")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium cursor-pointer transition-colors ${
            chatTab === "recent"
              ? "border-b-2 border-zinc-800 dark:border-zinc-200 text-zinc-800 dark:text-zinc-200"
              : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <Clock size={14} />
          {tc("recent")}
        </button>
        <button
          onClick={() => setChatTab("friends")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium cursor-pointer transition-colors ${
            chatTab === "friends"
              ? "border-b-2 border-zinc-800 dark:border-zinc-200 text-zinc-800 dark:text-zinc-200"
              : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <Users size={14} />
          {tc("friends")}
        </button>
      </div>

      {/* Contact list */}
      <div className="flex-1 overflow-y-auto">
        {isContactsLoading && (
          <div className="p-4 text-center text-sm text-zinc-400">
            {tcCommon("loading")}
          </div>
        )}
        {!isContactsLoading && contacts.length === 0 && (
          <div className="p-4 text-center text-sm text-zinc-400">
            {tc("noContacts")}
          </div>
        )}
        {contacts.map((contact) => (
          <button
            key={contact.id}
            onClick={() => openPrivateChat(contact)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center shrink-0">
              {contact.avatarUrl ? (
                <img
                  src={contact.avatarUrl}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <span className="text-zinc-600 dark:text-zinc-300 text-sm font-medium">
                  {contact.username.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                {contact.username}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
