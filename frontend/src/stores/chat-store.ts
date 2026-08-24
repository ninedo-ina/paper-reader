import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { AiChatListDto, AiChatDetailDto } from "@/lib/api/types"
import type { PaperContextChunkDto } from "@/lib/api/types"
import { listChats, getChat, createChat, sendMessage, deleteChat } from "@/lib/api/ai-chats"
import { usePreferencesStore, type AiProvider } from "@/stores/preferences-store"
import { EmptyAiResponseError } from "@/lib/ai-chat-response"
import {
  describeProviderNetworkError,
  normalizeProviderBaseUrl,
  redactProviderErrorText,
  requestAiChatCompletion,
  requestAiChatCompletionDetailed,
} from "@/lib/ai-provider"

export type ChatMessageStatus = "thinking" | "streaming" | "complete" | "error"

export interface PaperMessageContext {
  paperId: number
  paperTitle: string
  pageNumber: number
  quote: string
  abstractText?: string
  chunks: PaperContextChunkDto[]
}

export interface ChatMessageItem {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  reasoning?: string
  images?: string[]
  createdAt: string
  status?: ChatMessageStatus
  statusMessage?: string
  paperContext?: PaperMessageContext
}

/**
 * A browser-side conversation backed by the user's configured OpenAI-compatible
 * provider. It is intentionally separate from the server-side AI chat DTOs:
 * the latter use the backend's configured model, while these conversations use
 * the provider and API key selected in the client preferences.
 */
export interface DirectChat {
  id: string
  title: string
  model: string
  providerId: string
  messages: ChatMessageItem[]
  createdAt: string
  updatedAt: string
}

const MODELS = ["gpt-4o", "gpt-4o-mini", "claude-sonnet-4-6", "gemini-2.5-pro"] as const
const DEFAULT_DIRECT_TITLE = "新对话"
const DIRECT_TITLE_LIMIT = 32
const TITLE_CONTEXT_LIMIT = 1600

interface ChatState {
  chats: AiChatListDto[]
  activeChat: AiChatDetailDto | null
  messages: ChatMessageItem[]
  isLoading: boolean
  isSending: boolean
  error: string | null

  directChats: DirectChat[]
  activeDirectChatId: string | null
  directChatSending: Record<string, boolean>
  directChatTitleGenerating: Record<string, boolean>

  loadChats: () => Promise<void>
  selectChat: (id: number) => Promise<void>
  newChat: (paperId?: number, title?: string, model?: string) => Promise<AiChatDetailDto>
  send: (content: string) => Promise<void>
  removeChat: (id: number) => Promise<void>

  // Direct provider API
  sendDirect: (
    content: string,
    model: string,
    provider: AiProvider,
    paperContext?: PaperMessageContext,
  ) => Promise<void>
  addDirectMessage: (m: Omit<ChatMessageItem, "id" | "createdAt">) => void
  startDirectChat: (model: string, providerId: string) => string
  selectDirectChat: (id: string) => void
  updateDirectChatConfig: (
    id: string,
    config: Partial<Pick<DirectChat, "model" | "providerId">>,
  ) => void
  clearMessages: () => void
  appendStreamChunk: (chunk: string) => void
}

export { MODELS }

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function createDirectChat(model: string, providerId: string): DirectChat {
  const now = new Date().toISOString()
  return {
    id: createId(),
    title: DEFAULT_DIRECT_TITLE,
    model,
    providerId,
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
}

function updateDirectChat(
  chats: DirectChat[],
  chatId: string | null,
  messages: ChatMessageItem[],
  options?: { model?: string; providerId?: string },
): DirectChat[] {
  if (!chatId) return chats

  return chats.map((chat) => {
    if (chat.id !== chatId) return chat
    return {
      ...chat,
      messages,
      model: options?.model ?? chat.model,
      providerId: options?.providerId ?? chat.providerId,
      updatedAt: new Date().toISOString(),
    }
  })
}

function updateDirectChatConfig(
  chats: DirectChat[],
  chatId: string,
  config: Partial<Pick<DirectChat, "model" | "providerId">>,
): DirectChat[] {
  return chats.map((chat) => chat.id === chatId ? { ...chat, ...config } : chat)
}

function updateDirectChatProviderBaseUrl(
  providerId: string,
  baseUrl: string,
): void {
  const preferences = usePreferencesStore.getState()
  const provider = preferences.providers.find((item) => item.id === providerId)
  if (provider && normalizeProviderBaseUrl(provider.baseUrl) !== baseUrl) {
    preferences.updateProvider(providerId, { baseUrl })
  }
}

function updateDirectChatTitle(
  chats: DirectChat[],
  chatId: string,
  title: string,
): DirectChat[] {
  return chats.map((chat) =>
    chat.id === chatId && chat.title === DEFAULT_DIRECT_TITLE
      ? { ...chat, title }
      : chat,
  )
}

function withoutRecordKey(
  record: Record<string, boolean>,
  key: string,
): Record<string, boolean> {
  const next = { ...record }
  delete next[key]
  return next
}

function titleContext(value: string): string {
  return value
    .replace(/!\[[^\]]*]\([^)]*\)/g, "[图片]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TITLE_CONTEXT_LIMIT)
}

function buildPaperPrompt(content: string, context?: PaperMessageContext): string {
  if (!context) return content

  const chunks = context.chunks
    .map((chunk) => {
      const section = chunk.sectionTitle ? `章节：${chunk.sectionTitle}\n` : ""
      const page = chunk.pageStart ? `页码：${chunk.pageStart}\n` : ""
      return `${section}${page}${chunk.content}`
    })
    .join("\n\n")

  return [
    "你正在帮助用户阅读一篇论文。请只基于下方论文上下文回答；上下文不足时明确说明，不要编造论文没有提供的事实。",
    `论文标题：${context.paperTitle}`,
    context.abstractText ? `论文摘要：${context.abstractText}` : "",
    chunks ? `与选区相关的论文片段：\n${chunks}` : "",
    `用户选中的原文（第 ${context.pageNumber} 页）：\n${context.quote}`,
    `用户问题：${content}`,
  ].filter(Boolean).join("\n\n")
}

export function sanitizeDirectChatTitle(value: string): string {
  const title = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)
    ?.replace(/^#+\s*/, "")
    .replace(/^(?:对话)?标题\s*[:：-]\s*/i, "")
    .replace(/^title\s*[:：-]\s*/i, "")
    .replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, "")
    .trim() ?? ""

  if (!title) return ""
  return title.length > DIRECT_TITLE_LIMIT
    ? `${title.slice(0, DIRECT_TITLE_LIMIT - 1)}…`
    : title
}

function normalizedTitleText(value: string): string {
  return value.replace(/[\p{P}\p{S}\s]+/gu, "").toLocaleLowerCase()
}

function titleRepeatsUserMessage(title: string, userContent: string): boolean {
  const normalizedTitle = normalizedTitleText(title)
  if (!normalizedTitle) return true

  return [userContent, sanitizeDirectChatTitle(userContent)]
    .map(normalizedTitleText)
    .some((candidate) => candidate === normalizedTitle)
}

async function generateDirectChatTitle({
  userContent,
  assistantContent,
  model,
  provider,
  onBaseUrlResolved,
}: {
  userContent: string
  assistantContent: string
  model: string
  provider: AiProvider
  onBaseUrlResolved: (baseUrl: string) => void
}): Promise<string> {
  const result = await requestAiChatCompletion({
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    model,
    messages: [
      {
        role: "system",
        content:
          "你是对话标题生成器。请根据用户与 PR助手 的对话生成一个简洁、准确的标题。只输出标题，不要解释、引号、Markdown 或“标题”前缀；中文最多 18 个汉字，英文最多 8 个单词。",
      },
      {
        role: "user",
        content: `用户：${titleContext(userContent)}\nPR助手：${titleContext(assistantContent)}`,
      },
    ],
    onContent: () => undefined,
    onBaseUrlResolved,
    stream: false,
  })

  return sanitizeDirectChatTitle(result)
}

function updateMessage(
  messages: ChatMessageItem[],
  messageId: string,
  patch: Partial<ChatMessageItem>,
): ChatMessageItem[] {
  return messages.map((message) =>
    message.id === messageId ? { ...message, ...patch } : message,
  )
}

function updateDirectChatMessage(
  chats: DirectChat[],
  chatId: string,
  messageId: string,
  patch: Partial<ChatMessageItem>,
): DirectChat[] {
  return chats.map((chat) => {
    if (chat.id !== chatId) return chat
    return {
      ...chat,
      messages: updateMessage(chat.messages, messageId, patch),
      updatedAt: new Date().toISOString(),
    }
  })
}

function normalizeDirectMessages(
  messages: ChatMessageItem[],
  recoverInterrupted = false,
): ChatMessageItem[] {
  return messages.flatMap((message) => {
    if (message.role !== "assistant") return [message]

    if (message.status === "thinking" || message.status === "streaming") {
      if (!recoverInterrupted) return [message]
      return [{
        ...message,
        status: "error" as const,
        statusMessage: "上一次回复在页面关闭前未完成，请重新发送",
      }]
    }

    if (message.content.trim() || message.reasoning?.trim()) return [message]
    if (message.status === "error" && message.statusMessage) return [message]
    return []
  })
}

function describeDirectChatError(error: unknown, apiKey: string): string {
  if (error instanceof EmptyAiResponseError) return error.message
  const networkMessage = describeProviderNetworkError(error)
  return redactProviderErrorText(networkMessage, apiKey) || "未知错误"
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      chats: [],
      activeChat: null,
      messages: [],
      isLoading: false,
      isSending: false,
      error: null,
      directChats: [],
      activeDirectChatId: null,
      directChatSending: {},
      directChatTitleGenerating: {},

      loadChats: async () => {
        set({ isLoading: true, error: null })
        try {
          const res = await listChats()
          set({ chats: res.items, isLoading: false })
        } catch (e) {
          set({ isLoading: false, error: (e as Error).message })
        }
      },

      selectChat: async (id: number) => {
        set({ isLoading: true, error: null })
        try {
          const chat = await getChat(id)
          const messages: ChatMessageItem[] = chat.messages.map((message) => ({
            id: String(message.id),
            role: message.role,
            content: message.content,
            createdAt: message.createdAt,
          }))
          set({ activeChat: chat, activeDirectChatId: null, messages, isLoading: false })
        } catch (e) {
          set({ isLoading: false, error: (e as Error).message })
        }
      },

      newChat: async (paperId, title, model) => {
        set({ isLoading: true, error: null })
        try {
          const chat = await createChat({
            paperId,
            model: model ?? "gpt-4o-mini",
            title: title ?? "New Chat",
          })
          const messages: ChatMessageItem[] = chat.messages.map((message) => ({
            id: String(message.id),
            role: message.role,
            content: message.content,
            createdAt: message.createdAt,
          }))
          set((state) => ({
            activeChat: chat,
            activeDirectChatId: null,
            messages,
            chats: [
              {
                id: chat.id,
                title: chat.title,
                model: chat.model,
                paperId: chat.paperId,
                createdAt: chat.createdAt,
              },
              ...state.chats,
            ],
            isLoading: false,
          }))
          return chat
        } catch (e) {
          set({ isLoading: false, error: (e as Error).message })
          throw e
        }
      },

      send: async (content: string) => {
        const { activeChat } = get()
        if (!activeChat) return

        const userMessage: ChatMessageItem = {
          id: String(Date.now()),
          role: "user",
          content,
          createdAt: new Date().toISOString(),
        }
        set((state) => ({
          messages: [...state.messages, userMessage],
          isSending: true,
          error: null,
        }))
        try {
          const reply = await sendMessage(activeChat.id, { message: content })
          const assistantMessage: ChatMessageItem = {
            id: String(reply.id),
            role: reply.role,
            content: reply.content,
            createdAt: reply.createdAt,
          }
          set((state) => ({
            messages: [...state.messages, assistantMessage],
            isSending: false,
          }))
        } catch (e) {
          set({ isSending: false, error: (e as Error).message })
        }
      },

      removeChat: async (id: number) => {
        await deleteChat(id)
        set((state) => ({
          chats: state.chats.filter((chat) => chat.id !== id),
          activeChat: state.activeChat?.id === id ? null : state.activeChat,
          messages: state.activeChat?.id === id ? [] : state.messages,
        }))
      },

      startDirectChat: (model, providerId) => {
        const chat = createDirectChat(model, providerId)
        set((state) => ({
          directChats: [chat, ...state.directChats],
          activeDirectChatId: chat.id,
          activeChat: null,
          messages: [],
          error: null,
        }))
        return chat.id
      },

      selectDirectChat: (id) => {
        const chat = get().directChats.find((item) => item.id === id)
        if (!chat) return
        const messages = normalizeDirectMessages(chat.messages)
        set({
          activeDirectChatId: chat.id,
          activeChat: null,
          messages,
          error: null,
        })
      },

      updateDirectChatConfig: (id, config) =>
        set((state) => ({
          directChats: updateDirectChatConfig(state.directChats, id, config),
        })),

      // Direct provider API — streaming chat completions
      sendDirect: async (
        content: string,
        model: string,
        provider: AiProvider,
        paperContext?: PaperMessageContext,
      ) => {
        let directChatId = get().activeDirectChatId
        const currentDirectChat = get().directChats.find((chat) => chat.id === directChatId)
        if (!directChatId || !currentDirectChat) {
          directChatId = get().startDirectChat(model, provider.id)
        }
        const targetChatId = directChatId
        if (get().directChatSending[targetChatId]) return

        const targetChat = get().directChats.find((chat) => chat.id === targetChatId)
        const previousMessages = normalizeDirectMessages(targetChat?.messages ?? []).filter(
          (message) => message.content.trim() && message.status !== "error",
        )
        const userMessage: ChatMessageItem = {
          id: createId(),
          role: "user",
          content,
          paperContext,
          createdAt: new Date().toISOString(),
        }
        const assistantMessage: ChatMessageItem = {
          id: createId(),
          role: "assistant",
          content: "",
          reasoning: "",
          createdAt: new Date().toISOString(),
          status: "thinking",
        }
        set((state) => {
          const currentChat = state.directChats.find((chat) => chat.id === targetChatId)
          const messages = [
            ...normalizeDirectMessages(currentChat?.messages ?? []),
            userMessage,
            assistantMessage,
          ]
          return {
            messages: state.activeDirectChatId === targetChatId ? messages : state.messages,
            directChatSending: {
              ...state.directChatSending,
              [targetChatId]: true,
            },
            error: state.activeDirectChatId === targetChatId ? null : state.error,
            directChats: updateDirectChat(state.directChats, targetChatId, messages, {
              model,
              providerId: provider.id,
            }),
          }
        })

        const apiMessages = [...previousMessages, userMessage].map((message) => ({
          role: message.role,
          content: buildPaperPrompt(message.content, message.paperContext),
        }))
        let completedAssistantContent = ""
        let resolvedBaseUrl = normalizeProviderBaseUrl(provider.baseUrl)
        try {
          const assistantResult = await requestAiChatCompletionDetailed({
            baseUrl: provider.baseUrl,
            apiKey: provider.apiKey,
            model,
            messages: apiMessages,
            onContent: (nextContent) => {
              set((state) => ({
                messages:
                  state.activeDirectChatId === targetChatId
                    ? updateMessage(state.messages, assistantMessage.id, {
                        content: nextContent,
                        status: "streaming",
                        statusMessage: undefined,
                      })
                    : state.messages,
                directChats: updateDirectChatMessage(
                  state.directChats,
                  targetChatId,
                  assistantMessage.id,
                  {
                    content: nextContent,
                    status: "streaming",
                    statusMessage: undefined,
                  },
                ),
              }))
            },
            onReasoning: (nextReasoning) => {
              set((state) => ({
                messages:
                  state.activeDirectChatId === targetChatId
                    ? updateMessage(state.messages, assistantMessage.id, {
                        reasoning: nextReasoning,
                        status: "streaming",
                        statusMessage: undefined,
                      })
                    : state.messages,
                directChats: updateDirectChatMessage(
                  state.directChats,
                  targetChatId,
                  assistantMessage.id,
                  {
                    reasoning: nextReasoning,
                    status: "streaming",
                    statusMessage: undefined,
                  },
                ),
              }))
            },
            onBaseUrlResolved: (nextBaseUrl) => {
              resolvedBaseUrl = normalizeProviderBaseUrl(nextBaseUrl)
              updateDirectChatProviderBaseUrl(
                provider.id,
                resolvedBaseUrl,
              )
            },
          })
          completedAssistantContent = assistantResult.content || assistantResult.reasoning

          set((state) => ({
            messages:
              state.activeDirectChatId === targetChatId
                ? updateMessage(state.messages, assistantMessage.id, {
                    content: assistantResult.content,
                    reasoning: assistantResult.reasoning,
                    status: "complete",
                    statusMessage: undefined,
                  })
                : state.messages,
            directChats: updateDirectChatMessage(
              state.directChats,
              targetChatId,
              assistantMessage.id,
              {
                content: assistantResult.content,
                reasoning: assistantResult.reasoning,
                status: "complete",
                statusMessage: undefined,
              },
            ),
          }))
        } catch (e) {
          const errorMessage = describeDirectChatError(e, provider.apiKey)
          set((state) => {
            const patch: Partial<ChatMessageItem> = {
              status: "error",
              statusMessage: `回复失败：${errorMessage}`,
            }
            return {
              messages:
                state.activeDirectChatId === targetChatId
                  ? updateMessage(state.messages, assistantMessage.id, patch)
                  : state.messages,
              directChats: updateDirectChatMessage(
                state.directChats,
                targetChatId,
                assistantMessage.id,
                patch,
              ),
              error: state.activeDirectChatId === targetChatId ? errorMessage : state.error,
            }
          })
        } finally {
          set((state) => ({
            directChatSending: withoutRecordKey(state.directChatSending, targetChatId),
          }))
        }

        const chat = get().directChats.find((item) => item.id === targetChatId)
        if (
          !completedAssistantContent ||
          !chat ||
          chat.title !== DEFAULT_DIRECT_TITLE ||
          get().directChatTitleGenerating[targetChatId]
        ) {
          return
        }

        set((state) => ({
          directChatTitleGenerating: {
            ...state.directChatTitleGenerating,
            [targetChatId]: true,
          },
        }))
        try {
          const title = await generateDirectChatTitle({
            userContent: content,
            assistantContent: completedAssistantContent,
            model,
            provider: { ...provider, baseUrl: resolvedBaseUrl },
            onBaseUrlResolved: (nextBaseUrl) => {
              updateDirectChatProviderBaseUrl(
                provider.id,
                normalizeProviderBaseUrl(nextBaseUrl),
              )
            },
          })
          if (title && !titleRepeatsUserMessage(title, content)) {
            set((state) => ({
              directChats: updateDirectChatTitle(state.directChats, targetChatId, title),
            }))
          }
        } catch {
          // A failed title request must not turn a successful answer into an error.
        } finally {
          set((state) => ({
            directChatTitleGenerating: withoutRecordKey(
              state.directChatTitleGenerating,
              targetChatId,
            ),
          }))
        }
      },

      addDirectMessage: (message) =>
        set((state) => {
          const messages = [
            ...state.messages,
            { ...message, id: createId(), createdAt: new Date().toISOString() },
          ]
          return {
            messages,
            directChats: updateDirectChat(state.directChats, state.activeDirectChatId, messages),
          }
        }),

      clearMessages: () =>
        set({ messages: [], activeChat: null, activeDirectChatId: null, error: null }),

      appendStreamChunk: (chunk) =>
        set((state) => {
          const messages = [...state.messages]
          const last = messages[messages.length - 1]
          if (last && last.role === "assistant") {
            messages[messages.length - 1] = { ...last, content: last.content + chunk }
          }
          return {
            messages,
            directChats: updateDirectChat(state.directChats, state.activeDirectChatId, messages),
          }
        }),
    }),
    {
      name: "pr-ai-direct-chats",
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<ChatState>
        const directChats = (persisted.directChats ?? currentState.directChats).map((chat) => ({
          ...chat,
          messages: normalizeDirectMessages(chat.messages, true),
        }))
        const activeDirectChat = directChats.find(
          (chat) => chat.id === persisted.activeDirectChatId,
        )

        return {
          ...currentState,
          ...persisted,
          directChats,
          messages: activeDirectChat
            ? activeDirectChat.messages
            : normalizeDirectMessages(persisted.messages ?? currentState.messages, true),
          isSending: false,
          directChatSending: {},
          directChatTitleGenerating: {},
          error: null,
        }
      },
      partialize: (state) => ({
        directChats: state.directChats,
        activeDirectChatId: state.activeDirectChatId,
        messages: state.messages,
      }),
    },
  ),
)
