"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import {
  AlertTriangle,
  Bot,
  Brain,
  ChevronDown,
  ChevronRight,
  MessageSquarePlus,
  Quote,
  Send,
  Settings2,
  X,
} from "lucide-react"
import { useTranslations, useLocale } from "next-intl"
import { useChatStore, MODELS, INTERRUPTED_REPLY_STATUS } from "@/stores/chat-store"
import type { PaperMessageContext } from "@/stores/chat-store"
import { usePreferencesStore } from "@/stores/preferences-store"
import { useToastStore } from "@/stores/toast-store"
import { useUserStore } from "@/stores/user-store"
import { getPaperContext } from "@/lib/api/papers"
import { useReaderStore, type PendingPaperQuestion } from "@/stores/reader-store"
import { MarkdownContent } from "@/components/reader/MarkdownContent"
import { defaultAvatar, defaultDisplayName } from "@/lib/user-display"
import { cn } from "@/lib/utils"

interface ChatPanelProps {
  onConfigureProvider?: () => void
}

const THINKING_LABEL_KEYS = ["thinking", "processing", "organizing"] as const

function formatChatTime(value: string, locale: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "--"
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)
}

function ThinkingIndicator() {
  const t = useTranslations("assistant")
  const [labelIndex, setLabelIndex] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLabelIndex((index) => (index + 1) % THINKING_LABEL_KEYS.length)
    }, 1400)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div
      className="flex min-w-[104px] items-center gap-2 text-xs text-[var(--text-secondary)]"
      role="status"
      aria-label={t("thinkingAria")}
    >
      <span className="inline-block min-w-[52px]" aria-hidden="true">
        {t(THINKING_LABEL_KEYS[labelIndex])}
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

function ReasoningDisclosure({
  content,
  streaming,
}: {
  content: string
  streaming: boolean
}) {
  const t = useTranslations("assistant")
  const [open, setOpen] = useState(false)

  return (
    <div className="mb-2 border-l-2 border-[var(--border-color)] pl-2.5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-1.5 py-0.5 text-left text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
        aria-expanded={open}
      >
        <Brain className="size-3.5 shrink-0" />
        <span>{streaming ? t("reasoningActive") : t("reasoningTitle")}</span>
        <ChevronRight className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <MarkdownContent
          content={content}
          className="mt-1.5 text-xs text-[var(--text-secondary)] [&_pre]:rounded-md [&_pre]:bg-[var(--surface-2)]"
        />
      )}
    </div>
  )
}

export function ChatPanel({ onConfigureProvider }: ChatPanelProps) {
  const t = useTranslations("assistant")
  const locale = useLocale()
  const {
    messages,
    directChats,
    activeDirectChatId,
    directChatSending,
    sendDirect,
    startDirectChat,
    selectDirectChat,
    updateDirectChatConfig,
  } = useChatStore()
  const addToast = useToastStore((state) => state.addToast)
  const profile = useUserStore((state) => state.profile)
  const pendingPaperQuestion = useReaderStore((state) => state.pendingPaperQuestion)
  const consumePendingPaperQuestion = useReaderStore((state) => state.consumePendingPaperQuestion)
  const providers = usePreferencesStore((state) => state.providers)
  const activeProviderId = usePreferencesStore((state) => state.activeProviderId)
  const activeDirectChat = directChats.find((chat) => chat.id === activeDirectChatId) ?? null
  const activeDirectChatProviderId = activeDirectChat?.providerId
  const activeDirectChatModel = activeDirectChat?.model
  const defaultProviderId = activeDirectChat?.providerId || activeProviderId || providers[0]?.id || ""

  const [input, setInput] = useState("")
  const [composerQuote, setComposerQuote] = useState<PendingPaperQuestion | null>(null)
  const [selectedProviderId, setSelectedProviderId] = useState(defaultProviderId)
  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId) ?? null
  const availableModels = useMemo(
    () => (selectedProvider?.models.length ? selectedProvider.models : [...MODELS]),
    [selectedProvider],
  )
  const [selectedModel, setSelectedModel] = useState(
    activeDirectChat?.model || availableModels[0] || "gpt-4o-mini",
  )
  const [pastedImages, setPastedImages] = useState<string[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [providerOpen, setProviderOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const historyRef = useRef<HTMLDivElement>(null)
  const providerRef = useRef<HTMLDivElement>(null)
  const modelRef = useRef<HTMLDivElement>(null)
  const providerPromptedForRequest = useRef<string | null>(null)
  const currentChatSending = activeDirectChatId
    ? Boolean(directChatSending[activeDirectChatId])
    : false
  const historyChats = useMemo(
    () => [...directChats].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [directChats],
  )
  const displayName = profile ? defaultDisplayName(profile) : t("me")
  const avatar = defaultAvatar(profile?.email, displayName)
  const userInitial = avatar.initial

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (
      activeDirectChatId &&
      activeDirectChatProviderId !== undefined &&
      activeDirectChatModel !== undefined
    ) {
      setSelectedProviderId(activeDirectChatProviderId)
      setSelectedModel(activeDirectChatModel)
      return
    }
    const fallbackProviderId = activeProviderId || providers[0]?.id || ""
    setSelectedProviderId(fallbackProviderId)
    const fallbackProvider = providers.find((provider) => provider.id === fallbackProviderId)
    setSelectedModel(fallbackProvider?.models[0] || MODELS[0])
  }, [
    activeDirectChatId,
    activeDirectChatProviderId,
    activeDirectChatModel,
    activeProviderId,
    providers,
  ])

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (historyRef.current && !historyRef.current.contains(target)) setHistoryOpen(false)
      if (providerRef.current && !providerRef.current.contains(target)) setProviderOpen(false)
      if (modelRef.current && !modelRef.current.contains(target)) setModelOpen(false)
    }
    document.addEventListener("mousedown", handleOutsideClick)
    return () => document.removeEventListener("mousedown", handleOutsideClick)
  }, [])

  const showProviderRequired = useCallback(() => {
    addToast({
      message: t("providerRequired"),
      type: "info",
    })
  }, [addToast, t])

  const handleConfigureProvider = useCallback(() => {
    onConfigureProvider?.()
  }, [onConfigureProvider])

  const handleModelTrigger = useCallback(() => {
    if (!selectedProvider) {
      showProviderRequired()
      return
    }
    setModelOpen((open) => !open)
    setHistoryOpen(false)
    setProviderOpen(false)
  }, [selectedProvider, showProviderRequired])

  const handleModelSelect = useCallback((model: string) => {
    setSelectedModel(model)
    if (activeDirectChatId) updateDirectChatConfig(activeDirectChatId, { model })
    setModelOpen(false)
  }, [activeDirectChatId, updateDirectChatConfig])

  const handleProviderTrigger = useCallback(() => {
    if (providers.length === 0) {
      showProviderRequired()
      return
    }
    setProviderOpen((open) => !open)
    setHistoryOpen(false)
    setModelOpen(false)
  }, [providers.length, showProviderRequired])

  const handleProviderSelect = useCallback((providerId: string) => {
    const provider = providers.find((item) => item.id === providerId)
    if (!provider) return
    const nextModel = provider.models.includes(selectedModel)
      ? selectedModel
      : provider.models[0] || MODELS[0]
    setSelectedProviderId(provider.id)
    setSelectedModel(nextModel)
    if (activeDirectChatId) {
      updateDirectChatConfig(activeDirectChatId, {
        providerId: provider.id,
        model: nextModel,
      })
    }
    setProviderOpen(false)
  }, [activeDirectChatId, providers, selectedModel, updateDirectChatConfig])

  const handleNewChat = useCallback(() => {
    const inheritedProviderId = activeDirectChat?.providerId || selectedProviderId || activeProviderId || providers[0]?.id || ""
    const inheritedModel = activeDirectChat?.model || selectedModel || MODELS[0]
    startDirectChat(inheritedModel, inheritedProviderId)
    setSelectedProviderId(inheritedProviderId)
    setSelectedModel(inheritedModel)
    setInput("")
    setComposerQuote(null)
    setPastedImages([])
    setHistoryOpen(false)
    setProviderOpen(false)
    setModelOpen(false)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [activeDirectChat, activeProviderId, providers, selectedModel, selectedProviderId, startDirectChat])

  const handleHistorySelect = useCallback((id: string) => {
    const chat = directChats.find((item) => item.id === id)
    if (!chat) return
    selectDirectChat(id)
    setSelectedProviderId(chat.providerId)
    setSelectedModel(chat.model)
    setHistoryOpen(false)
    setInput("")
    setComposerQuote(null)
    setPastedImages([])
  }, [directChats, selectDirectChat])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || currentChatSending) return

    if (!selectedProvider) {
      showProviderRequired()
      return
    }

    const quote = composerQuote
    setInput("")
    setComposerQuote(null)
    const content = pastedImages.length > 0
      ? text + "\n" + pastedImages.map((image, index) => `![image-${index}](${image})`).join("\n")
      : text
    setPastedImages([])

    if (!quote) {
      await sendDirect(content, selectedModel, selectedProvider)
      return
    }

    let context: PaperMessageContext = {
      paperId: quote.paperId,
      paperTitle: quote.paperTitle,
      pageNumber: quote.pageNumber,
      quote: quote.selectedText,
      chunks: [],
    }

    try {
      const response = await getPaperContext(quote.paperId, {
        selectedText: quote.selectedText,
        pageNumber: quote.pageNumber,
      })
      context = {
        ...context,
        paperTitle: response.title || quote.paperTitle,
        abstractText: response.abstractText,
        chunks: response.chunks,
      }
      if (response.parseStatus === "PENDING" || response.parseStatus === "PROCESSING") {
        addToast({ message: t("contextParsing"), type: "info" })
      }
    } catch {
      addToast({ message: t("contextUnavailable"), type: "info" })
    }

    await sendDirect(content, selectedModel, selectedProvider, context)
  }, [addToast, composerQuote, currentChatSending, input, pastedImages, selectedModel, selectedProvider, sendDirect, showProviderRequired, t])

  useEffect(() => {
    const question = consumePendingPaperQuestion()
    if (!question) return
    setComposerQuote(question)
    requestAnimationFrame(() => inputRef.current?.focus())
    if (!selectedProvider && providerPromptedForRequest.current !== question.requestId) {
      providerPromptedForRequest.current = question.requestId
      addToast({ message: t("providerRequiredQuote"), type: "info" })
      onConfigureProvider?.()
    }
  }, [
    addToast,
    consumePendingPaperQuestion,
    onConfigureProvider,
    pendingPaperQuestion,
    selectedProvider,
    t,
  ])

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

  const currentTitle = activeDirectChat?.title || t("newChat")

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Conversation controls */}
      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2">
        <div className="relative min-w-0 flex-1" ref={historyRef}>
          <button
            type="button"
            onClick={() => {
              setHistoryOpen((open) => !open)
              setProviderOpen(false)
              setModelOpen(false)
            }}
            className="flex min-w-0 max-w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-left text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            aria-label={t("selectHistory")}
          >
            <span className="truncate">{currentTitle}</span>
            <ChevronDown className={cn("size-3 shrink-0 text-[var(--text-tertiary)] transition-transform", historyOpen && "rotate-180")} />
          </button>
          {historyOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 w-[min(310px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--surface-0)] py-1 shadow-xl">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                {t("history")}
              </div>
              {historyChats.length === 0 ? (
                <p className="px-3 py-3 text-xs text-[var(--text-tertiary)]">{t("noHistory")}</p>
              ) : (
                <div className="max-h-64 overflow-auto">
                  {historyChats.map((chat) => (
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
                        <span className="block truncate text-xs text-[var(--text-primary)]">{chat.title || t("newChat")}</span>
                        <span className="block text-[10px] leading-4 text-[var(--text-tertiary)]">
                          {providers.find((provider) => provider.id === chat.providerId)?.name ?? t("providerDeleted")} · {chat.model}
                          {directChatSending[chat.id] ? ` · ${t("replying")}` : ""}
                        </span>
                        <span className="block text-[10px] leading-4 text-[var(--text-tertiary)]">
                          {t("createdAt", { time: formatChatTime(chat.createdAt, locale) })}
                        </span>
                        <span className="block text-[10px] leading-4 text-[var(--text-tertiary)]">
                          {t("lastMessageAt", { time: formatChatTime(chat.updatedAt, locale) })}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative" ref={providerRef}>
          <button
            type="button"
            onClick={providers.length > 0 ? handleProviderTrigger : handleConfigureProvider}
            className={cn(
              "inline-flex max-w-[130px] items-center gap-1 rounded-md px-1.5 py-1 text-[10px] transition-colors",
              selectedProvider
                ? "text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                : "text-amber-600 hover:bg-amber-500/10 dark:text-amber-400",
            )}
            title={providers.length > 0 ? t("selectChatProvider") : t("providerRequiredShort")}
          >
            {selectedProvider ? (
              <span className="max-w-[108px] truncate">{selectedProvider.name}</span>
            ) : (
              <>
                <AlertTriangle className="size-3.5" />
                <span>{providers.length > 0 ? t("selectProvider") : t("noProvider")}</span>
              </>
            )}
            {providers.length > 0 && (
              <ChevronDown className={cn("size-3 shrink-0", providerOpen && "rotate-180")} />
            )}
          </button>
          {providerOpen && providers.length > 0 && (
            <div className="absolute right-0 top-full z-50 mt-1 w-[210px] overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--surface-0)] py-1 shadow-xl">
              <div className="px-3 py-1.5 text-[10px] text-[var(--text-tertiary)]">{t("selectProvider")}</div>
              {providers.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => handleProviderSelect(provider.id)}
                  className={cn(
                    "block w-full truncate px-3 py-2 text-left text-xs hover:bg-[var(--bg-hover)]",
                    selectedProviderId === provider.id && "font-medium text-[var(--accent)]",
                  )}
                >
                  {provider.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleNewChat}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          title={t("newChat")}
          aria-label={t("newChat")}
        >
          <MessageSquarePlus className="size-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 space-y-4 overflow-auto px-3 py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <Bot className="size-8 text-[var(--text-tertiary)]" />
            <p className="text-sm text-[var(--text-tertiary)]">{t("emptyHint")}</p>
            {!selectedProvider && (
              <button
                type="button"
                onClick={handleConfigureProvider}
                className="text-xs text-[var(--accent)] hover:underline"
              >
                {t("providerRequiredShort")}
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
              <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10" title={t("assistantName")}>
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
                <div>
                  <p className="mb-1 text-[10px] font-medium text-[var(--text-tertiary)]">{t("assistantName")}</p>
                  {message.status === "thinking" && !message.content.trim() && !message.reasoning?.trim() ? (
                    <ThinkingIndicator />
                  ) : (
                    <>
                      {message.reasoning?.trim() && (
                        <ReasoningDisclosure
                          content={message.reasoning}
                          streaming={message.status === "streaming"}
                        />
                      )}
                      {message.content.trim() && (
                        <MarkdownContent
                          content={message.content}
                          images={message.images}
                          className="text-sm [&_pre]:rounded-md [&_pre]:bg-[var(--surface-2)]"
                        />
                      )}
                      {message.status === "error" && (
                        <p
                          className={cn(
                            "whitespace-pre-wrap break-words text-xs text-red-600 dark:text-red-400",
                            (message.content.trim() || message.reasoning?.trim()) && "mt-2 border-t border-red-500/15 pt-2",
                          )}
                          role="alert"
                        >
                          {message.statusMessage === INTERRUPTED_REPLY_STATUS
                            ? t("replyInterrupted")
                            : message.statusMessage || t("replyFailed")}
                        </p>
                      )}
                      {!message.content.trim() && !message.reasoning?.trim() && message.status !== "error" && (
                        <p className="text-xs text-[var(--text-tertiary)]">{t("emptyReply")}</p>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div>
                  {message.paperContext && (
                    <div className="mb-2 rounded-lg border border-current/15 bg-black/5 px-2.5 py-2 dark:bg-white/5">
                      <p className="mb-1 text-[10px] font-medium opacity-70">
                        {t("pageRef", { title: message.paperContext.paperTitle, page: message.paperContext.pageNumber })}
                      </p>
                      <p className="line-clamp-4 whitespace-pre-wrap break-words text-xs opacity-80">
                        “{message.paperContext.quote}”
                      </p>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                </div>
              )}
            </div>
            {message.role === "user" && (
              <div
                className="mt-0.5 flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-semibold"
                style={{ background: avatar.background, color: avatar.foreground }}
                title={displayName}
              >
                {profile?.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={displayName} className="size-full object-cover" />
                ) : (
                  userInitial
                )}
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
                aria-label={t("removeImage")}
              >
                <X className="size-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="border-t border-[var(--border-subtle)] px-3 pb-3 pt-2">
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/70 shadow-[var(--shadow-sm)] transition-colors focus-within:border-[var(--accent)]/50">
          {composerQuote && (
            <div className="mx-3 mt-3 rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 px-3 py-2.5">
              <div className="flex items-start gap-2">
                <Quote className="mt-0.5 size-3.5 shrink-0 text-[var(--accent)]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                    {t("pageRef", { title: composerQuote.paperTitle, page: composerQuote.pageNumber })}
                  </p>
                  <p className="mt-1 max-h-16 overflow-hidden whitespace-pre-wrap break-words text-xs leading-5 text-[var(--text-primary)]">
                    “{composerQuote.selectedText}”
                  </p>
                </div>
                <button type="button" onClick={() => setComposerQuote(null)} className="shrink-0 rounded-md p-1 text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]" aria-label={t("removeQuote")}>
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
          )}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={selectedProvider ? (composerQuote ? t("inputPlaceholderQuoted") : t("inputPlaceholder")) : t("inputPlaceholderNoProvider")}
            rows={3}
            disabled={currentChatSending}
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
                  selectedProvider
                    ? "text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                    : "text-amber-600 hover:bg-amber-500/10 dark:text-amber-400",
                )}
                title={selectedProvider ? t("configureProvider") : t("providerRequiredShort")}
              >
                {selectedProvider ? <Settings2 className="size-3" /> : <AlertTriangle className="size-3" />}
                <span className="truncate">{selectedProvider ? t("provider") : t("configureProvider")}</span>
              </button>

              <div className="relative" ref={modelRef}>
                <button
                  type="button"
                  onClick={handleModelTrigger}
                  className={cn(
                    "inline-flex max-w-[150px] items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] transition-colors",
                    selectedProvider
                      ? "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                      : "cursor-not-allowed text-[var(--text-placeholder)]",
                  )}
                  title={selectedProvider ? t("selectModel") : t("providerRequiredShort")}
                  aria-disabled={!selectedProvider}
                >
                  <span className="max-w-[120px] truncate">{selectedProvider ? selectedModel : t("noProvider")}</span>
                  <ChevronDown className={cn("size-3 shrink-0", modelOpen && "rotate-180")} />
                </button>
                {modelOpen && selectedProvider && (
                  <div className="absolute bottom-full left-0 z-50 mb-1 w-[190px] overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--surface-0)] py-1 shadow-xl">
                    <div className="px-3 py-1.5 text-[10px] text-[var(--text-tertiary)]">{t("selectModel")}</div>
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
              disabled={!input.trim() || currentChatSending}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--surface-1)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={t("sendMessage")}
            >
              <Send className="size-3.5" />
            </button>
          </div>
        </div>
        <p className="mt-1.5 px-1 text-[10px] text-[var(--text-placeholder)]">{t("disclaimer")}</p>
      </div>
    </div>
  )
}
