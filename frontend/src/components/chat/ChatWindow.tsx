"use client"

import { useState, useRef, useEffect } from "react"
import { useTranslations } from "next-intl"
import { useUserStore } from "@/stores/user-store"
import { useImStore } from "@/stores/im-store"
import { ArrowLeft, Send } from "lucide-react"

export function ChatWindow() {
  const tc = useTranslations("chat")
  const tcCommon = useTranslations("common")
  const profile = useUserStore((s) => s.profile)
  const activeChat = useImStore((s) => s.activeChat)
  const messages = useImStore((s) => s.messages)
  const isMessagesLoading = useImStore((s) => s.isMessagesLoading)
  const sendMessage = useImStore((s) => s.sendMessage)
  const setActiveView = useImStore((s) => s.setActiveView)

  const [input, setInput] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = () => {
    if (!input.trim()) return
    sendMessage(input.trim())
    setInput("")
  }

  const handleBack = () => {
    setActiveView("list")
  }

  const getSenderName = (msg: typeof messages[number]) =>
    "senderUsername" in msg ? msg.senderUsername : msg.username

  const title =
    activeChat?.type === "private"
      ? activeChat.target.username
      : activeChat?.name ?? ""

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={handleBack}
          className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer text-zinc-500"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="font-medium text-sm text-zinc-800 dark:text-zinc-200 truncate">
          {title}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isMessagesLoading && (
          <div className="text-center text-sm text-zinc-400 py-8">
            {tcCommon("loading")}
          </div>
        )}
        {!isMessagesLoading && messages.length === 0 && (
          <div className="text-center text-sm text-zinc-400 py-8">
            {tc("noMessages")}
          </div>
        )}
        {messages.map((msg, i) => {
          const isOwn = "senderId" in msg && msg.senderId === profile?.id
          return (
            <div
              key={msg.id || i}
              className={`flex gap-2 mb-4 ${isOwn ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${
                  isOwn
                    ? "bg-zinc-800 text-white rounded-br-md"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-bl-md"
                }`}
              >
                {"senderUsername" in msg && !isOwn && (
                  <div className="text-xs font-medium text-zinc-400 mb-0.5">
                    {getSenderName(msg)}
                  </div>
                )}
                <div className="break-words">{msg.content}</div>
                <div
                  className={`text-[10px] mt-1 ${
                    isOwn ? "text-zinc-400" : "text-zinc-400"
                  }`}
                >
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={tc("messagePlaceholder")}
          className="flex-1 px-4 py-2.5 rounded-full border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 outline-none focus:border-zinc-400"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-600 text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
