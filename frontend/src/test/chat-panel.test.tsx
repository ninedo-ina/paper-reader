import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ChatPanel } from "@/components/chat/ChatPanel"
import { useChatStore } from "@/stores/chat-store"

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
    })
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
      })
    })
    vi.useRealTimers()
  })

  it("cycles visible processing text inside the assistant bubble", () => {
    render(<ChatPanel />)

    const status = screen.getByRole("status", { name: "AI 正在处理" })
    expect(status).toHaveTextContent("思考中")

    act(() => vi.advanceTimersByTime(1400))
    expect(status).toHaveTextContent("正在处理")
  })
})
