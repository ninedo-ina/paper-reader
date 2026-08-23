import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ChatPanel } from "@/components/chat/ChatPanel"
import { useChatStore } from "@/stores/chat-store"
import { usePreferencesStore, type AiProvider } from "@/stores/preferences-store"
import { useUserStore } from "@/stores/user-store"

const firstProvider: AiProvider = {
  id: "provider-first",
  name: "First Provider",
  baseUrl: "https://first.example/v1",
  apiKey: "first-key",
  models: ["first-model"],
  active: true,
}

const secondProvider: AiProvider = {
  id: "provider-second",
  name: "Second Provider",
  baseUrl: "https://second.example/v1",
  apiKey: "second-key",
  models: ["second-model", "second-model-alt"],
  active: false,
}

describe("ChatPanel thinking state", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Element.prototype.scrollIntoView = vi.fn()
    useChatStore.setState({
      messages: [
        {
          id: "assistant-thinking",
          role: "assistant",
          content: "",
          createdAt: new Date().toISOString(),
          status: "thinking",
        },
      ],
      isSending: true,
      error: null,
      directChats: [],
      activeDirectChatId: null,
      directChatSending: {},
      directChatTitleGenerating: {},
    })
    usePreferencesStore.setState({ providers: [], activeProviderId: null })
    useUserStore.setState({ profile: null, isLoading: false })
  })

  afterEach(() => {
    cleanup()
    act(() => {
      useChatStore.setState({
        messages: [],
        isSending: false,
        error: null,
        directChats: [],
        activeDirectChatId: null,
        directChatSending: {},
        directChatTitleGenerating: {},
      })
    })
    usePreferencesStore.setState({ providers: [], activeProviderId: null })
    useUserStore.setState({ profile: null, isLoading: false })
    vi.useRealTimers()
  })

  it("cycles visible processing text inside the assistant bubble", () => {
    render(<ChatPanel />)

    const status = screen.getByRole("status", { name: "AI 正在处理" })
    expect(status).toHaveTextContent("思考中")

    act(() => vi.advanceTimersByTime(1400))
    expect(status).toHaveTextContent("正在处理")
  })

  it("renders the user avatar, names the assistant, and restores per-chat settings", () => {
    const createdAt = "2026-01-02T03:04:00.000Z"
    const updatedAt = "2026-01-03T04:05:00.000Z"
    const otherCreatedAt = "2026-01-01T03:04:00.000Z"
    const otherUpdatedAt = "2026-01-01T04:05:00.000Z"
    const firstChat = {
      id: "chat-first",
      title: "论文方法总结",
      model: "first-model",
      providerId: firstProvider.id,
      messages: [
        {
          id: "user-message",
          role: "user" as const,
          content: "请总结方法",
          createdAt,
        },
        {
          id: "assistant-message",
          role: "assistant" as const,
          content: "这是方法总结。",
          createdAt: updatedAt,
          status: "complete" as const,
        },
      ],
      createdAt,
      updatedAt,
    }
    const secondChat = {
      id: "chat-second",
      title: "实验结果分析",
      model: "second-model",
      providerId: secondProvider.id,
      messages: [],
      createdAt: otherCreatedAt,
      updatedAt: otherUpdatedAt,
    }

    usePreferencesStore.setState({
      providers: [firstProvider, secondProvider],
      activeProviderId: firstProvider.id,
    })
    useUserStore.setState({
      profile: {
        id: 1,
        email: "reader@example.com",
        displayName: "论文读者",
        avatarUrl: "https://example.com/avatar.png",
        authProvider: "password",
      },
      isLoading: false,
    })
    useChatStore.setState({
      messages: firstChat.messages,
      directChats: [firstChat, secondChat],
      activeDirectChatId: firstChat.id,
      directChatSending: {},
      directChatTitleGenerating: {},
    })

    render(<ChatPanel />)

    expect(screen.getByRole("img", { name: "论文读者" })).toHaveAttribute(
      "src",
      "https://example.com/avatar.png",
    )
    expect(screen.getAllByText("PR助手").length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole("button", { name: "选择历史对话" }))
    expect(screen.getAllByText(/创建/)).toHaveLength(2)
    expect(screen.getAllByText(/最后对话/)).toHaveLength(2)

    fireEvent.click(screen.getByTitle("选择当前对话 Provider"))
    fireEvent.click(screen.getByRole("button", { name: "Second Provider" }))
    expect(useChatStore.getState().directChats.find((chat) => chat.id === firstChat.id)).toMatchObject({
      providerId: secondProvider.id,
      model: "second-model",
    })

    fireEvent.click(screen.getByTitle("选择模型"))
    fireEvent.click(screen.getByRole("button", { name: "second-model-alt" }))
    expect(useChatStore.getState().directChats.find((chat) => chat.id === firstChat.id)?.model).toBe(
      "second-model-alt",
    )

    fireEvent.click(screen.getByRole("button", { name: "选择历史对话" }))
    fireEvent.click(screen.getByRole("button", { name: /实验结果分析/ }))
    expect(useChatStore.getState().activeDirectChatId).toBe(secondChat.id)
    expect(screen.getByTitle("选择当前对话 Provider")).toHaveTextContent("Second Provider")

    fireEvent.click(screen.getByRole("button", { name: "新对话" }))
    const newChat = useChatStore.getState().directChats.find(
      (chat) => chat.id === useChatStore.getState().activeDirectChatId,
    )
    expect(newChat).toMatchObject({
      providerId: secondProvider.id,
      model: "second-model",
    })
  })
})
