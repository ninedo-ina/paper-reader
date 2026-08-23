import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useChatStore } from "@/stores/chat-store"
import type { AiProvider } from "@/stores/preferences-store"

const provider: AiProvider = {
  id: "provider-test",
  name: "Test Provider",
  baseUrl: "https://provider.example/v1",
  apiKey: "test-key",
  models: ["test-model"],
  active: true,
}

function resetChatStore() {
  useChatStore.setState({
    chats: [],
    activeChat: null,
    messages: [],
    isLoading: false,
    isSending: false,
    error: null,
    directChats: [],
    activeDirectChatId: null,
  })
}

describe("direct chat response lifecycle", () => {
  beforeEach(() => {
    localStorage.removeItem("pr-ai-direct-chats")
    resetChatStore()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.removeItem("pr-ai-direct-chats")
    resetChatStore()
  })

  it("shows a thinking assistant message before the provider responds", async () => {
    let resolveFetch!: (response: Response) => void
    const pendingFetch = new Promise<Response>((resolve) => {
      resolveFetch = resolve
    })
    const fetchMock = vi.fn<typeof fetch>().mockReturnValue(pendingFetch)
    vi.stubGlobal("fetch", fetchMock)

    const request = useChatStore.getState().sendDirect("请解释这篇论文", "test-model", provider)
    await Promise.resolve()

    expect(useChatStore.getState().messages.at(-1)).toMatchObject({
      role: "assistant",
      content: "",
      status: "thinking",
    })
    expect(useChatStore.getState().isSending).toBe(true)

    resolveFetch(
      new Response('data:{"choices":[{"delta":{"content":"好的，我来解释。"}}]}\n\ndata:[DONE]\n', {
        headers: { "content-type": "text/event-stream" },
      }),
    )
    await request

    expect(useChatStore.getState().messages.at(-1)).toMatchObject({
      role: "assistant",
      content: "好的，我来解释。",
      status: "complete",
    })
    expect(useChatStore.getState().isSending).toBe(false)
  })

  it("turns an empty or failed provider response into a visible assistant error", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "model unavailable" } }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    await useChatStore.getState().sendDirect("测试", "test-model", provider)

    expect(useChatStore.getState().messages.at(-1)).toMatchObject({
      role: "assistant",
      content: "",
      status: "error",
    })
    expect(useChatStore.getState().messages.at(-1)?.statusMessage).toContain("HTTP 400")
    expect(useChatStore.getState().isSending).toBe(false)
  })
})
