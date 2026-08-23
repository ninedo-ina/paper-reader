import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useChatStore } from "@/stores/chat-store"
import { usePreferencesStore, type AiProvider } from "@/stores/preferences-store"

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
    directChatSending: {},
    directChatTitleGenerating: {},
  })
}

function titleResponse(title: string): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: title } }] }),
    { headers: { "content-type": "application/json" } },
  )
}

function resetPreferencesStore() {
  usePreferencesStore.setState({
    providers: [],
    activeProviderId: null,
  })
}

describe("direct chat response lifecycle", () => {
  beforeEach(() => {
    localStorage.removeItem("pr-ai-direct-chats")
    localStorage.removeItem("pr-preferences")
    resetChatStore()
    resetPreferencesStore()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.removeItem("pr-ai-direct-chats")
    localStorage.removeItem("pr-preferences")
    resetChatStore()
    resetPreferencesStore()
  })

  it("shows a thinking assistant message before the provider responds", async () => {
    let resolveFetch!: (response: Response) => void
    const pendingFetch = new Promise<Response>((resolve) => {
      resolveFetch = resolve
    })
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(pendingFetch)
      .mockResolvedValueOnce(titleResponse("论文内容解读"))
    vi.stubGlobal("fetch", fetchMock)

    const request = useChatStore.getState().sendDirect("请解释这篇论文", "test-model", provider)
    await Promise.resolve()

    expect(useChatStore.getState().messages.at(-1)).toMatchObject({
      role: "assistant",
      content: "",
      status: "thinking",
    })
    expect(useChatStore.getState().directChatSending).toEqual(
      expect.objectContaining({ [useChatStore.getState().activeDirectChatId!]: true }),
    )

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
    expect(useChatStore.getState().directChatSending).toEqual({})
    expect(useChatStore.getState().directChats[0]?.title).toBe("论文内容解读")
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
    expect(useChatStore.getState().directChatSending).toEqual({})
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("keeps the thinking bubble and completes it with a non-streaming retry", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response('data: {"choices":[{"finish_reason":"stop"}]}\n\ndata: [DONE]\n', {
          headers: { "content-type": "text/event-stream" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ choices: [{ message: { content: "兜底回复" } }] }),
          { headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(titleResponse("论文内容解读"))
    vi.stubGlobal("fetch", fetchMock)

    await useChatStore.getState().sendDirect("测试兜底", "test-model", provider)

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      stream: true,
    })
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      stream: false,
    })
    expect(useChatStore.getState().messages.at(-1)).toMatchObject({
      role: "assistant",
      content: "兜底回复",
      status: "complete",
    })
    expect(useChatStore.getState().directChatSending).toEqual({})
    expect(useChatStore.getState().directChats[0]?.title).toBe("论文内容解读")
    expect(useChatStore.getState().directChats[0]?.title).not.toBe("测试兜底")
  })

  it("does not use the user question when the title model repeats it", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: "正常回复" } }] }), {
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(titleResponse("标题：请解释这篇论文"))
    vi.stubGlobal("fetch", fetchMock)

    await useChatStore.getState().sendDirect("请解释这篇论文", "test-model", provider)

    expect(useChatStore.getState().directChats[0]?.title).toBe("新对话")
    expect(useChatStore.getState().directChats[0]?.messages.at(-1)).toMatchObject({
      content: "正常回复",
      status: "complete",
    })
  })

  it("shows both safe response diagnostics when the retry is also empty", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          'data: {"id":"private-stream-id","choices":[{"finish_reason":"stop"}]}\n\ndata: [DONE]\n',
          { headers: { "content-type": "text/event-stream" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            request_id: "private-fallback-id",
            custom_payload: { metadata_only: true },
          }),
          { headers: { "content-type": "application/json" } },
        ),
      )
    vi.stubGlobal("fetch", fetchMock)

    await useChatStore.getState().sendDirect("测试诊断", "test-model", provider)

    const message = useChatStore.getState().messages.at(-1)
    expect(message).toMatchObject({ role: "assistant", status: "error" })
    expect(message?.statusMessage).toContain("stream={content-type=text/event-stream")
    expect(message?.statusMessage).toContain("non-stream={content-type=application/json")
    expect(message?.statusMessage).not.toContain("private-stream-id")
    expect(message?.statusMessage).not.toContain("private-fallback-id")
  })

  it("persists a corrected /v1 Base URL after direct chat fallback", async () => {
    const providerWithoutV1 = { ...provider, baseUrl: "https://provider.example" }
    usePreferencesStore.setState({
      providers: [providerWithoutV1],
      activeProviderId: providerWithoutV1.id,
    })
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response("<html><body>Provider portal</body></html>", {
          headers: { "content-type": "text/html" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: "回退回复" } }] }), {
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(titleResponse("接口回退诊断"))
    vi.stubGlobal("fetch", fetchMock)

    await useChatStore.getState().sendDirect("测试端点回退", "test-model", providerWithoutV1)

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://provider.example/chat/completions",
      "https://provider.example/v1/chat/completions",
      "https://provider.example/v1/chat/completions",
    ])
    expect(usePreferencesStore.getState().providers[0]?.baseUrl).toBe(
      "https://provider.example/v1",
    )
    expect(useChatStore.getState().messages.at(-1)).toMatchObject({
      role: "assistant",
      content: "回退回复",
      status: "complete",
    })
  })

  it("keeps provider and model configuration isolated between conversations", () => {
    const secondProvider = { ...provider, id: "provider-second", name: "Second Provider", models: ["second-model"] }
    const firstChatId = useChatStore.getState().startDirectChat("test-model", provider.id)
    useChatStore.getState().updateDirectChatConfig(firstChatId, {
      providerId: secondProvider.id,
      model: "second-model",
    })
    const secondChatId = useChatStore.getState().startDirectChat("test-model", provider.id)

    expect(useChatStore.getState().directChats.find((chat) => chat.id === firstChatId)).toMatchObject({
      providerId: secondProvider.id,
      model: "second-model",
    })
    expect(useChatStore.getState().directChats.find((chat) => chat.id === secondChatId)).toMatchObject({
      providerId: provider.id,
      model: "test-model",
    })

    useChatStore.getState().selectDirectChat(firstChatId)
    expect(useChatStore.getState().activeDirectChatId).toBe(firstChatId)
    expect(useChatStore.getState().directChats.find((chat) => chat.id === firstChatId)).toMatchObject({
      providerId: secondProvider.id,
      model: "second-model",
    })
    expect(useChatStore.getState().directChats.find((chat) => chat.id === secondChatId)).toMatchObject({
      providerId: provider.id,
      model: "test-model",
    })
  })

  it("continues a different conversation while the first one is waiting", async () => {
    let resolveFirst!: (response: Response) => void
    const firstResponse = new Promise<Response>((resolve) => {
      resolveFirst = resolve
    })
    let resolveSecond!: (response: Response) => void
    const secondResponse = new Promise<Response>((resolve) => {
      resolveSecond = resolve
    })
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(firstResponse)
      .mockReturnValueOnce(secondResponse)
      .mockResolvedValueOnce(titleResponse("第二个主题"))
      .mockResolvedValueOnce(titleResponse("第一个主题"))
    vi.stubGlobal("fetch", fetchMock)

    const firstChatId = useChatStore.getState().startDirectChat("test-model", provider.id)
    const firstRequest = useChatStore.getState().sendDirect("第一个问题", "test-model", provider)
    await Promise.resolve()
    expect(useChatStore.getState().directChatSending[firstChatId]).toBe(true)

    const secondChatId = useChatStore.getState().startDirectChat("test-model", provider.id)
    const secondRequest = useChatStore.getState().sendDirect("第二个问题", "test-model", provider)
    await Promise.resolve()
    expect(useChatStore.getState().directChatSending).toEqual({
      [firstChatId]: true,
      [secondChatId]: true,
    })

    resolveSecond(
      new Response('data: {"choices":[{"delta":{"content":"第二个回复"}}]}\n\ndata: [DONE]\n', {
        headers: { "content-type": "text/event-stream" },
      }),
    )
    await secondRequest

    expect(useChatStore.getState().directChatSending).toEqual({ [firstChatId]: true })
    expect(useChatStore.getState().directChats.find((chat) => chat.id === secondChatId)?.messages.at(-1)).toMatchObject({
      content: "第二个回复",
      status: "complete",
    })

    useChatStore.getState().selectDirectChat(firstChatId)
    resolveFirst(
      new Response('data: {"choices":[{"delta":{"content":"第一个回复"}}]}\n\ndata: [DONE]\n', {
        headers: { "content-type": "text/event-stream" },
      }),
    )
    await firstRequest

    expect(useChatStore.getState().directChatSending).toEqual({})
    expect(useChatStore.getState().directChats.find((chat) => chat.id === firstChatId)?.messages.at(-1)).toMatchObject({
      content: "第一个回复",
      status: "complete",
    })
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })
})
