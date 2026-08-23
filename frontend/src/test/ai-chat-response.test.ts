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

  it("falls through empty content fields to compatible text fields", async () => {
    const streamed = new Response(
      'data: {"choices":[{"delta":{"content":"","text":"流式文本"}}]}\n\ndata: [DONE]\n',
      { headers: { "content-type": "text/event-stream" } },
    )
    const complete = new Response(
      JSON.stringify({ message: { content: [], text: "完整文本" } }),
      { headers: { "content-type": "application/json" } },
    )

    await expect(consumeAiChatResponse(streamed, () => undefined)).resolves.toBe("流式文本")
    await expect(consumeAiChatResponse(complete, () => undefined)).resolves.toBe("完整文本")
  })

  it("supports JSON arrays containing Gemini-style streaming chunks", async () => {
    const response = new Response(
      JSON.stringify([
        { candidates: [{ content: { parts: [{ text: "数组" }] } }] },
        { candidates: [{ content: { parts: [{ text: "回复" }] } }] },
      ]),
      { headers: { "content-type": "application/json" } },
    )

    await expect(consumeAiChatResponse(response, () => undefined)).resolves.toBe("数组回复")
  })

  it("supports nested provider wrappers and a top-level message object", async () => {
    const wrapped = new Response(
      JSON.stringify({
        message: "success",
        data: {
          result: {
            message: { content: [{ type: "text", text: { value: "嵌套回复" } }] },
          },
        },
      }),
      { headers: { "content-type": "application/json" } },
    )
    const topLevel = new Response(
      JSON.stringify({ message: { role: "assistant", content: "顶层回复" } }),
      { headers: { "content-type": "application/json" } },
    )

    await expect(consumeAiChatResponse(wrapped, () => undefined)).resolves.toBe("嵌套回复")
    await expect(consumeAiChatResponse(topLevel, () => undefined)).resolves.toBe("顶层回复")
  })

  it("supports a non-streaming Responses API output payload", async () => {
    const response = new Response(
      JSON.stringify({
        output: [
          {
            type: "message",
            content: [
              { type: "output_text", text: { value: "Responses API 回复" } },
            ],
          },
        ],
      }),
      { headers: { "content-type": "application/json" } },
    )

    await expect(consumeAiChatResponse(response, () => undefined)).resolves.toBe(
      "Responses API 回复",
    )
  })

  it("supports NDJSON and multiple data lines in one SSE event", async () => {
    const ndjson = new Response(
      [
        JSON.stringify({ choices: [{ delta: { content: "ND" } }] }),
        JSON.stringify({ choices: [{ delta: { content: "JSON" } }] }),
      ].join("\n"),
      { headers: { "content-type": "application/x-ndjson" } },
    )
    const multilineSse = new Response(
      [
        'data: {"choices":[{"delta":',
        'data: {"content":"多行事件"}}]}',
        "",
        "data: [DONE]",
        "",
      ].join("\n"),
      { headers: { "content-type": "text/event-stream" } },
    )

    await expect(consumeAiChatResponse(ndjson, () => undefined)).resolves.toBe("NDJSON")
    await expect(consumeAiChatResponse(multilineSse, () => undefined)).resolves.toBe("多行事件")
  })

  it("uses reasoning text only when no final content was returned", async () => {
    const reasoningOnly = new Response(
      [
        'data: {"choices":[{"delta":{"reasoning_content":"可见"}}]}',
        'data: {"choices":[{"delta":{"reasoning_content":"兜底"}}]}',
        "data: [DONE]",
        "",
      ].join("\n"),
      { headers: { "content-type": "text/event-stream" } },
    )
    const answerWithReasoning = new Response(
      [
        'data: {"choices":[{"delta":{"reasoning_content":"内部推理"}}]}',
        'data: {"choices":[{"delta":{"content":"正式答案"}}]}',
        "data: [DONE]",
        "",
      ].join("\n"),
      { headers: { "content-type": "text/event-stream" } },
    )

    await expect(consumeAiChatResponse(reasoningOnly, () => undefined)).resolves.toBe("可见兜底")
    await expect(consumeAiChatResponse(answerWithReasoning, () => undefined)).resolves.toBe(
      "正式答案",
    )
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
