"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import {
  AlertTriangle,
  Bot,
  ChevronDown,
  MessageSquarePlus,
  Send,
  Settings2,
  User,
  X,
} from "lucide-react"
import { useChatStore, MODELS } from "@/stores/chat-store"
import { usePreferencesStore } from "@/stores/preferences-store"
import { useToastStore } from "@/stores/toast-store"
import { MarkdownContent } from "@/components/reader/MarkdownContent"
import { cn } from "@/lib/utils"

interface ChatPanelProps {
  onConfigureProvider?: () => void
}

const THINKING_LABELS = ["思考中", "正在处理", "整理答案"] as const

function ThinkingIndicator() {
  const [labelIndex, setLabelIndex] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLabelIndex((index) => (index + 1) % THINKING_LABELS.length)
    }, 1400)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div
      className="flex min-w-[104px] items-center gap-2 text-xs text-[var(--text-secondary)]"
      role="status"
      aria-label="AI 正在处理"
    >
      <span className="inline-block min-w-[52px]" aria-hidden="true">
        {THINKING_LABELS[labelIndex]}
      </span>
      <span className="flex items-center gap-1" aria-hidden="true">
        {[0, 160, 320].map((delay) => (
          <span
            key={delay}
            className="size-1.5 animate-bounce rounded-full bg-[var(--accent)]"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
    </div>
  )
}

export function ChatPanel({ onConfigureProvider }: ChatPanelProps) {
  const {
    messages,
    isSending,
    directChats,
    activeDirectChatId,
    sendDirect,
    startDirectChat,
    selectDirectChat,
  } = useChatStore()
  const addToast = useToastStore((state) => state.addToast)
  const providers = usePreferencesStore((state) => state.providers)
  const activeProviderId = usePreferencesStore((state) => state.activeProviderId)
  const activeProvider = providers.find((provider) => provider.id === activeProviderId) ?? null

  const availableModels = useMemo(
    () => (activeProvider?.models.length ? activeProvider.models : [...MODELS]),
    [activeProvider],
  )
  const activeDirectChat = directChats.find((chat) => chat.id === activeDirectChatId) ?? null

  const [input, setInput] = useState("")
  const [selectedModel, setSelectedModel] = useState(availableModels[0] ?? "gpt-4o-mini")
  const [pastedImages, setPastedImages] = useState<string[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const historyRef = useRef<HTMLDivElement>(null)
  const modelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (availableModels.length > 0 && !availableModels.includes(selectedModel)) {
      setSelectedModel(availableModels[0])
    }
  }, [activeProviderId, availableModels, selectedModel])

  useEffect(() => {
    if (activeDirectChat?.model && availableModels.includes(activeDirectChat.model)) {
      setSelectedModel(activeDirectChat.model)
    }
  }, [activeDirectChat?.id, activeDirectChat?.model, availableModels])

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (historyRef.current && !historyRef.current.contains(target)) setHistoryOpen(false)
      if (modelRef.current && !modelRef.current.contains(target)) setModelOpen(false)
    }
    document.addEventListener("mousedown", handleOutsideClick)
    return () => document.removeEventListener("mousedown", handleOutsideClick)
  }, [])

  const showProviderRequired = useCallback(() => {
    addToast({
      message: "请先配置并激活一个 Provider，再选择模型或发送消息。",
      type: "info",
    })
  }, [addToast])

  const handleConfigureProvider = useCallback(() => {
    onConfigureProvider?.()
  }, [onConfigureProvider])

  const handleModelTrigger = useCallback(() => {
    if (!activeProvider) {
      showProviderRequired()
      return
    }
    setModelOpen((open) => !open)
    setHistoryOpen(false)
  }, [activeProvider, showProviderRequired])

  const handleModelSelect = useCallback((model: string) => {
    setSelectedModel(model)
    setModelOpen(false)
  }, [])

  const handleNewChat = useCallback(() => {
    startDirectChat(activeProvider ? selectedModel : MODELS[0], activeProvider?.id ?? "")
    setInput("")
    setPastedImages([])
    setHistoryOpen(false)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [activeProvider, selectedModel, startDirectChat])

  const handleHistorySelect = useCallback((id: string) => {
    const chat = directChats.find((item) => item.id === id)
    if (!chat) return
    selectDirectChat(id)
    setSelectedModel(chat.model)
    setHistoryOpen(false)
    setInput("")
    setPastedImages([])
  }, [directChats, selectDirectChat])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isSending) return

    if (!activeProvider) {
      showProviderRequired()
      return
    }

    setInput("")
    const content = pastedImages.length > 0
      ? text + "\n" + pastedImages.map((image, index) => `![image-${index}](${image})`).join("\n")
      : text
    setPastedImages([])

    await sendDirect(content, selectedModel, activeProvider)
  }, [input, isSending, activeProvider, selectedModel, pastedImages, sendDirect, showProviderRequired])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault()
        void handleSend()
      }
    },
    [handleSend],
  )

  const handlePaste = useCallback((event: React.ClipboardEvent) => {
    const items = event.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (!item.type.startsWith("image/")) continue
      const file = item.getAsFile()
      if (!file) continue
      const reader = new FileReader()
      reader.onload = () => setPastedImages((images) => [...images, reader.result as string])
      reader.readAsDataURL(file)
    }
  }, [])

  const currentTitle = activeDirectChat?.title ?? "新对话"

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Conversation controls */}
      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2">
        <div className="relative min-w-0 flex-1" ref={historyRef}>
          <button
            type="button"
            onClick={() => {
              setHistoryOpen((open) => !open)
              setModelOpen(false)
            }}
            className="flex min-w-0 max-w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-left text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            aria-label="选择历史对话"
          >
            <span className="truncate">{currentTitle}</span>
            <ChevronDown className={cn("size-3 shrink-0 text-[var(--text-tertiary)] transition-transform", historyOpen && "rotate-180")} />
          </button>
          {historyOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 w-[250px] overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--surface-0)] py-1 shadow-xl">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                历史对话
              </div>
              {directChats.length === 0 ? (
                <p className="px-3 py-3 text-xs text-[var(--text-tertiary)]">暂无历史对话</p>
              ) : (
                <div className="max-h-64 overflow-auto">
                  {directChats.map((chat) => (
                    <button
                      key={chat.id}
                      type="button"
                      onClick={() => handleHistorySelect(chat.id)}
                      className={cn(
                        "flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--bg-hover)]",
                        activeDirectChatId === chat.id && "bg-[var(--accent)]/10",
                      )}
                    >
                      <span className="mt-0.5 rounded-md bg-[var(--bg-hover)] p-1 text-[var(--text-tertiary)]">
                        <Bot className="size-3" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs text-[var(--text-primary)]">{chat.title}</span>
                        <span className="mt-0.5 block truncate text-[10px] text-[var(--text-tertiary)]">{chat.model}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {!activeProvider ? (
          <button
            type="button"
            onClick={handleConfigureProvider}
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-amber-600 transition-colors hover:bg-amber-500/10 dark:text-amber-400"
            title="请先配置 Provider"
          >
            <AlertTriangle className="size-3.5" />
            <span>未配置 Provider</span>
          </button>
        ) : (
          <span className="max-w-[120px] truncate text-[10px] text-[var(--text-tertiary)]" title={activeProvider.name}>
            {activeProvider.name}
          </span>
        )}

        <button
          type="button"
          onClick={handleNewChat}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          title="新对话"
          aria-label="新对话"
        >
          <MessageSquarePlus className="size-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 space-y-4 overflow-auto px-3 py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <Bot className="size-8 text-[var(--text-tertiary)]" />
            <p className="text-sm text-[var(--text-tertiary)]">在下方输入文本开始 AI 对话</p>
            {!activeProvider && (
              <button
                type="button"
                onClick={handleConfigureProvider}
                className="text-xs text-[var(--accent)] hover:underline"
              >
                请先配置 Provider
              </button>
            )}
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn("flex gap-2.5", message.role === "user" ? "justify-end" : "justify-start")}
          >
            {message.role !== "user" && (
              <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10">
                <Bot className="size-3.5 text-[var(--accent)]" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                message.role === "user"
                  ? "rounded-br-md bg-[var(--accent)] text-[var(--surface-1)]"
                  : message.status === "error"
                    ? "rounded-bl-md border border-red-500/20 bg-red-500/5 text-[var(--text-primary)]"
                    : "rounded-bl-md bg-[var(--bg-hover)] text-[var(--text-primary)]",
              )}
            >
              {message.role === "assistant" ? (
                message.status === "thinking" && !message.content.trim() ? (
                  <ThinkingIndicator />
                ) : message.status === "error" ? (
                  <div>
                    {message.content.trim() && (
                      <MarkdownContent
                        content={message.content}
                        images={message.images}
                        className="text-sm [&_pre]:rounded-md [&_pre]:bg-[var(--surface-2)]"
                      />
                    )}
                    <p
                      className={cn(
                        "whitespace-pre-wrap break-words text-xs text-red-600 dark:text-red-400",
                        message.content.trim() && "mt-2 border-t border-red-500/15 pt-2",
                      )}
                      role="alert"
                    >
                      {message.statusMessage ?? "回复失败，请重新发送"}
                    </p>
                  </div>
                ) : message.content.trim() ? (
                  <MarkdownContent
                    content={message.content}
                    images={message.images}
                    className="text-sm [&_pre]:rounded-md [&_pre]:bg-[var(--surface-2)]"
                  />
                ) : (
                  <p className="text-xs text-[var(--text-tertiary)]">未收到可显示的回复</p>
                )
              ) : (
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
              )}
            </div>
            {message.role === "user" && (
              <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)]">
                <User className="size-3.5 text-[var(--text-tertiary)]" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      {pastedImages.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pb-1">
          {pastedImages.map((src, index) => (
            <div key={index} className="group relative">
              <img src={src} alt="" className="size-14 rounded-lg border border-[var(--border-subtle)] object-cover" />
              <button
                type="button"
                onClick={() => setPastedImages((images) => images.filter((_, imageIndex) => imageIndex !== index))}
                className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-red-500 opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="移除图片"
              >
                <X className="size-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="border-t border-[var(--border-subtle)] px-3 pb-3 pt-2">
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/70 shadow-[var(--shadow-sm)] transition-colors focus-within:border-[var(--accent)]/50">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={activeProvider ? "输入消息，Enter 发送，Shift+Enter 换行" : "请先配置 Provider 后开始对话"}
            rows={3}
            disabled={isSending}
            className="block max-h-32 min-h-[72px] w-full resize-none border-0 bg-transparent px-3.5 py-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-placeholder)] disabled:opacity-50"
          />
          <div className="flex items-center justify-between gap-2 px-2.5 pb-2">
            <div className="min-w-0 flex-1" />
            <div className="flex min-w-0 items-center justify-end gap-1">
              <button
                type="button"
                onClick={handleConfigureProvider}
                className={cn(
                  "inline-flex max-w-[120px] items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] transition-colors",
                  activeProvider
                    ? "text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                    : "text-amber-600 hover:bg-amber-500/10 dark:text-amber-400",
                )}
                title={activeProvider ? "配置 Provider" : "请先配置 Provider"}
              >
                {activeProvider ? <Settings2 className="size-3" /> : <AlertTriangle className="size-3" />}
                <span className="truncate">{activeProvider ? "Provider" : "配置 Provider"}</span>
              </button>

              <div className="relative" ref={modelRef}>
                <button
                  type="button"
                  onClick={handleModelTrigger}
                  className={cn(
                    "inline-flex max-w-[150px] items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] transition-colors",
                    activeProvider
                      ? "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                      : "cursor-not-allowed text-[var(--text-placeholder)]",
                  )}
                  title={activeProvider ? "选择模型" : "请先配置 Provider"}
                  aria-disabled={!activeProvider}
                >
                  <span className="max-w-[120px] truncate">{activeProvider ? selectedModel : "未配置 Provider"}</span>
                  <ChevronDown className={cn("size-3 shrink-0", modelOpen && "rotate-180")} />
                </button>
                {modelOpen && activeProvider && (
                  <div className="absolute bottom-full left-0 z-50 mb-1 w-[190px] overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--surface-0)] py-1 shadow-xl">
                    <div className="px-3 py-1.5 text-[10px] text-[var(--text-tertiary)]">选择模型</div>
                    {availableModels.map((model) => (
                      <button
                        key={model}
                        type="button"
                        onClick={() => handleModelSelect(model)}
                        className={cn(
                          "block w-full truncate px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--bg-hover)]",
                          selectedModel === model && "font-medium text-[var(--accent)]",
                        )}
                      >
                        {model}
                      </button>
                    ))}
                  </div>
                )}
              </div>

            </div>

            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!input.trim() || isSending}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--surface-1)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="发送消息"
            >
              <Send className="size-3.5" />
            </button>
          </div>
        </div>
        <p className="mt-1.5 px-1 text-[10px] text-[var(--text-placeholder)]">AI 生成内容仅供参考，请核对重要信息</p>
      </div>
    </div>
  )
}
