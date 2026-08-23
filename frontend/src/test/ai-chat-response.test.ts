import { describe, expect, it } from "vitest"
import {
  consumeAiChatResponse,
  EMPTY_AI_RESPONSE_MESSAGE,
} from "@/lib/ai-chat-response"

function responseFromChunks(chunks: string[], contentType: string): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)))
      controller.close()
    },
  })

  return new Response(stream, { headers: { "content-type": contentType } })
}

describe("consumeAiChatResponse", () => {
  it("supports SSE without a space after data and a final line without a newline", async () => {
    const updates: string[] = []
    const response = responseFromChunks(
      [
        'data:{"choices":[{"delta":{"con',
        'tent":"你好"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"，世界"}}]}\n',
        'data:[DONE]',
      ],
      "text/event-stream",
    )

    await expect(consumeAiChatResponse(response, (content) => updates.push(content))).resolves.toBe(
      "你好，世界",
    )
    expect(updates).toEqual(["你好", "你好，世界"])
  })

  it("supports a non-streaming OpenAI-compatible JSON response", async () => {
    const response = new Response(
      JSON.stringify({ choices: [{ message: { content: "这是完整回复" } }] }),
      { headers: { "content-type": "application/json" } },
    )

    await expect(consumeAiChatResponse(response, () => undefined)).resolves.toBe("这是完整回复")
  })

  it("still parses SSE when a provider labels it as application/json", async () => {
    const response = new Response(
      'data:{"choices":[{"delta":{"content":"兼容错误响应头"}}]}\n\ndata:[DONE]\n',
      { headers: { "content-type": "application/json" } },
    )

    await expect(consumeAiChatResponse(response, () => undefined)).resolves.toBe("兼容错误响应头")
  })

  it("rejects a successful response that contains no displayable text", async () => {
    const response = new Response('data:{"choices":[{"finish_reason":"stop"}]}\n\ndata:[DONE]\n', {
      headers: { "content-type": "text/event-stream" },
    })

    await expect(consumeAiChatResponse(response, () => undefined)).rejects.toThrow(
      EMPTY_AI_RESPONSE_MESSAGE,
    )
  })
})
