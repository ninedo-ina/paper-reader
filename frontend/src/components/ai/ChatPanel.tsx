"use client"

import { useEffect, useCallback, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Plus, Trash2, MessageSquare, Bot, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { ChatMessage } from "./ChatMessage"
import { ChatInput } from "./ChatInput"
import { useChatStore, MODELS } from "@/stores/chat-store"
import { cn } from "@/lib/utils"

interface ChatPanelProps {
  paperId?: number
  paperTitle?: string
}

export function ChatPanel({ paperId, paperTitle }: ChatPanelProps) {
  const t = useTranslations("ai")
  const [showModelMenu, setShowModelMenu] = useState(false)
  const [selectedModel, setSelectedModel] = useState("gpt-4o-mini")
  const menuRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const { chats, activeChat, messages, isSending, loadChats, selectChat, newChat, send, removeChat } =
    useChatStore()

  useEffect(() => { loadChats() }, [loadChats])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowModelMenu(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const handleNewChat = useCallback(async () => {
    await newChat(paperId, paperTitle ?? "New Chat", selectedModel)
  }, [paperId, paperTitle, selectedModel, newChat])

  const handleSend = useCallback(
    async (content: string) => {
      if (!activeChat) {
        await newChat(paperId, paperTitle ?? "New Chat", selectedModel)
      }
      await send(content)
    },
    [activeChat, paperId, paperTitle, selectedModel, newChat, send],
  )

  return (
    <div className="h-full flex flex-col bg-[var(--surface-0)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-color)]">
        <Bot className="size-4 text-[var(--accent)]" />
        <span className="text-sm font-medium text-[var(--text-primary)]">AI Chat</span>
        <div className="flex-1" />
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowModelMenu(!showModelMenu)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-[var(--text-tertiary)] border border-[var(--border-color)] hover:text-[var(--text-primary)] transition-colors"
          >
            {selectedModel}
            <ChevronDown className="size-2.5" />
          </button>
          {showModelMenu && (
            <div className="absolute right-0 top-full mt-1 w-40 rounded-xl border border-[var(--border-color)] bg-[var(--surface-0)] shadow-xl z-50 py-1">
              {MODELS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setSelectedModel(m); setShowModelMenu(false) }}
                  className={cn("w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--surface-2)]", selectedModel === m && "text-[var(--accent)] font-medium")}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={handleNewChat}>
          <Plus className="size-4" />
        </Button>
      </div>

      {/* Chat list (when no active chat) */}
      {!activeChat && (
        <div className="flex-1 overflow-auto">
          {chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
              <MessageSquare className="size-8 text-[var(--text-tertiary)]" />
              <p className="text-sm text-[var(--text-tertiary)] text-center">{t("emptyChat")}</p>
              <Button size="sm" onClick={handleNewChat}>
                <Plus className="size-4" />
                New Chat
              </Button>
            </div>
          ) : (
            <div className="p-2 flex flex-col gap-1">
              {chats.map((chat) => (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => selectChat(chat.id)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-left hover:bg-[var(--surface-2)] transition-colors group"
                >
                  <MessageSquare className="size-4 text-[var(--text-tertiary)] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[var(--text-primary)] truncate">{chat.title}</p>
                    <p className="text-[10px] text-[var(--text-tertiary)]">{chat.model}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); removeChat(chat.id) }}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active chat messages */}
      {activeChat && (
        <div className="flex-1 overflow-auto py-2">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {isSending && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-tertiary)]">
              <div className="flex gap-1">
                <span className="size-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="size-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="size-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      {activeChat && <ChatInput onSend={handleSend} isSending={isSending} paperTitle={paperTitle} />}
    </div>
  )
}
