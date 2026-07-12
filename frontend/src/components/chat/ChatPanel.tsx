"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Bot, User, ImageIcon, Paperclip, X } from "lucide-react"
import { useChatStore, MODELS } from "@/stores/chat-store"
import { usePreferencesStore } from "@/stores/preferences-store"
import { MarkdownContent } from "@/components/reader/MarkdownContent"
import { cn } from "@/lib/utils"

export function ChatPanel() {
  const { messages, isSending, error, sendDirect, addDirectMessage, clearMessages } = useChatStore()
  const providers = usePreferencesStore((s) => s.providers)
  const activeProviderId = usePreferencesStore((s) => s.activeProviderId)
  const activeProvider = providers.find((p) => p.id === activeProviderId) ?? null

  const availableModels = activeProvider?.models.length
    ? activeProvider.models
    : [...MODELS]

  const [input, setInput] = useState("")
  const [selectedModel, setSelectedModel] = useState(availableModels[0] ?? "gpt-4o-mini")
  const [pastedImages, setPastedImages] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (availableModels.length > 0 && !availableModels.includes(selectedModel)) {
      setSelectedModel(availableModels[0])
    }
  }, [activeProviderId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isSending) return

    if (!activeProvider) {
      // No provider — show error as a system message
      addDirectMessage({ role: "assistant", content: "请先在偏好设置中配置并激活一个 AI Provider。", images: [] })
      return
    }

    setInput("")
    const content = pastedImages.length > 0
      ? text + "\n" + pastedImages.map((img, i) => `![image-${i}](${img})`).join("\n")
      : text
    setPastedImages([])

    await sendDirect(content, selectedModel, activeProvider)
  }, [input, isSending, activeProvider, selectedModel, pastedImages, sendDirect, addDirectMessage])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile()
        if (file) {
          const reader = new FileReader()
          reader.onload = () => {
            setPastedImages((prev) => [...prev, reader.result as string])
          }
          reader.readAsDataURL(file)
        }
      }
    }
  }, [])

  const removeImage = (idx: number) => {
    setPastedImages((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleNewChat = () => {
    clearMessages()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)]">
        <span className="text-xs text-[var(--text-tertiary)]">
          {activeProvider ? `Provider: ${activeProvider.name}` : "未配置 Provider"}
        </span>
        <button
          onClick={handleNewChat}
          className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
        >
          新对话
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto px-3 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2">
            <Bot className="size-8 text-[var(--text-tertiary)]" />
            <p className="text-sm text-[var(--text-tertiary)]">在下方输入文本开始 AI 对话</p>
            {!activeProvider && (
              <p className="text-xs text-[var(--text-tertiary)]">请在偏好设置中配置 Provider</p>
            )}
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn("flex gap-2.5", msg.role === "user" ? "justify-end" : "justify-start")}
          >
            {msg.role === "assistant" && (
              <div className="size-7 rounded-full bg-[var(--accent)]/10 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="size-3.5 text-[var(--accent)]" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-[var(--accent)] text-white rounded-br-md"
                  : "bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-bl-md",
              )}
            >
              {msg.role === "assistant" ? (
                <MarkdownContent
                  content={msg.content}
                  images={msg.images}
                  className="text-sm [&_pre]:bg-[var(--surface-2)] [&_pre]:rounded-md"
                />
              ) : (
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
              )}
            </div>
            {msg.role === "user" && (
              <div className="size-7 rounded-full bg-[var(--surface-2)] flex items-center justify-center shrink-0 mt-0.5">
                <User className="size-3.5 text-[var(--text-tertiary)]" />
              </div>
            )}
          </div>
        ))}
        {isSending && (
          <div className="flex gap-2.5 justify-start">
            <div className="size-7 rounded-full bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
              <Bot className="size-3.5 text-[var(--accent)]" />
            </div>
            <div className="bg-[var(--bg-hover)] rounded-2xl rounded-bl-md px-3.5 py-2.5">
              <div className="flex gap-1">
                <span className="size-2 rounded-full bg-[var(--text-tertiary)] animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="size-2 rounded-full bg-[var(--text-tertiary)] animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="size-2 rounded-full bg-[var(--text-tertiary)] animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        {error && (
          <p className="text-xs text-red-500 text-center">{error}</p>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Pasted images preview */}
      {pastedImages.length > 0 && (
        <div className="px-3 pb-1 flex gap-2 flex-wrap">
          {pastedImages.map((src, idx) => (
            <div key={idx} className="relative group">
              <img src={src} alt="" className="size-14 rounded-lg object-cover border border-[var(--border-subtle)]" />
              <button
                onClick={() => removeImage(idx)}
                className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="size-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-[var(--border-subtle)] p-3 space-y-2">
        {/* Model selector */}
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-1.5 text-xs text-[var(--text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        >
          {availableModels.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        {/* Text input */}
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={activeProvider ? "输入消息，Enter 发送，Shift+Enter 换行" : "请先在偏好设置中配置 Provider"}
          rows={2}
          disabled={isSending}
          className="w-full resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50"
        />
      </div>
    </div>
  )
}
