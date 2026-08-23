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

  it("supports DashScope and Spark-style nested output containers", async () => {
    const dashScope = new Response(
      JSON.stringify({
        output: {
          choices: [
            {
              message: {
                role: "assistant",
                content: [{ text: "DashScope 回复" }],
              },
            },
          ],
        },
      }),
      { headers: { "content-type": "application/json" } },
    )
    const spark = new Response(
      JSON.stringify({
        payload: {
          choices: {
            status: 2,
            text: [{ role: "assistant", content: "Spark 回复" }],
          },
        },
      }),
      { headers: { "content-type": "application/json" } },
    )

    await expect(consumeAiChatResponse(dashScope, () => undefined)).resolves.toBe(
      "DashScope 回复",
    )
    await expect(consumeAiChatResponse(spark, () => undefined)).resolves.toBe("Spark 回复")
  })

  it("supports capitalized and custom semantic response fields", async () => {
    const capitalized = new Response(
      JSON.stringify({
        Choices: [{ Message: { Role: "assistant", Content: "大写字段回复" } }],
      }),
      { headers: { "content-type": "application/json" } },
    )
    const custom = new Response(
      JSON.stringify({
        custom_envelope: {
          generated_response_value: "自定义字段回复",
        },
      }),
      { headers: { "content-type": "application/json" } },
    )

    await expect(consumeAiChatResponse(capitalized, () => undefined)).resolves.toBe(
      "大写字段回复",
    )
    await expect(consumeAiChatResponse(custom, () => undefined)).resolves.toBe(
      "自定义字段回复",
    )
  })

  it("supports AI SDK text-delta events and data stream text parts", async () => {
    const eventStream = new Response(
      [
        'data: {"type":"text-delta","delta":"AI "}',
        'data: {"type":"text-delta","delta":"SDK"}',
        "data: [DONE]",
        "",
      ].join("\n"),
      { headers: { "content-type": "text/event-stream" } },
    )
    const dataStream = new Response(
      ['0:"数据"', '0:"流"', 'd:{"finishReason":"stop"}'].join("\n"),
      { headers: { "content-type": "text/plain; charset=utf-8" } },
    )

    await expect(consumeAiChatResponse(eventStream, () => undefined)).resolves.toBe("AI SDK")
    await expect(consumeAiChatResponse(dataStream, () => undefined)).resolves.toBe("数据流")
  })

  it("supports a later non-empty choice and concatenated JSON objects", async () => {
    const laterChoice = new Response(
      JSON.stringify({
        choices: [
          { message: { content: "" } },
          { message: { content: "第二个 choice" } },
        ],
      }),
      { headers: { "content-type": "application/json" } },
    )
    const concatenated = new Response(
      [
        JSON.stringify({ token: "拼接" }),
        JSON.stringify({ token: " JSON" }),
      ].join(""),
      { headers: { "content-type": "application/json" } },
    )

    await expect(consumeAiChatResponse(laterChoice, () => undefined)).resolves.toBe(
      "第二个 choice",
    )
    await expect(consumeAiChatResponse(concatenated, () => undefined)).resolves.toBe(
      "拼接 JSON",
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

  it("accepts a plain-text answer even when the Provider labels it as JSON", async () => {
    const response = new Response("这是被错误标记的纯文本回复", {
      headers: { "content-type": "application/json" },
    })

    await expect(consumeAiChatResponse(response, () => undefined)).resolves.toBe(
      "这是被错误标记的纯文本回复",
    )
  })

  it("does not turn echoed user input into an assistant response", async () => {
    const response = new Response(
      JSON.stringify({
        request: {
          messages: [{ role: "user", content: "private user prompt" }],
        },
        RequestEcho: {
          Message: { Role: "User", Content: "capitalized private prompt" },
        },
        metadata: { status: "accepted" },
      }),
      { headers: { "content-type": "application/json" } },
    )

    await expect(consumeAiChatResponse(response, () => undefined)).rejects.toThrow(
      EMPTY_AI_RESPONSE_MESSAGE,
    )
  })

  it("rejects a successful response that contains no displayable text", async () => {
    const response = new Response('data:{"choices":[{"finish_reason":"stop"}]}\n\ndata:[DONE]\n', {
      headers: { "content-type": "text/event-stream" },
    })

    await expect(consumeAiChatResponse(response, () => undefined)).rejects.toThrow(
      EMPTY_AI_RESPONSE_MESSAGE,
    )
  })

  it("reports a Provider business error returned with HTTP 200", async () => {
    const response = new Response(
      JSON.stringify({
        success: false,
        code: 40101,
        error: { message: "model permission denied" },
      }),
      { headers: { "content-type": "application/json" } },
    )
    const wrappedStatus = new Response(
      JSON.stringify({
        code: "invalid_model",
        message: "selected model is unavailable",
      }),
      { headers: { "content-type": "application/json" } },
    )
    const capitalizedError = new Response(
      JSON.stringify({
        Error: { Message: "capitalized provider error" },
      }),
      { headers: { "content-type": "application/json" } },
    )

    await expect(consumeAiChatResponse(response, () => undefined)).rejects.toThrow(
      "Provider 业务错误：model permission denied",
    )
    await expect(consumeAiChatResponse(wrappedStatus, () => undefined)).rejects.toThrow(
      "Provider 业务错误：selected model is unavailable",
    )
    await expect(consumeAiChatResponse(capitalizedError, () => undefined)).rejects.toThrow(
      "Provider 业务错误：capitalized provider error",
    )
  })

  it("reports HTML endpoints and emits value-free diagnostics for unknown JSON", async () => {
    const html = new Response("<html><body>Provider portal</body></html>", {
      headers: { "content-type": "text/html" },
    })
    const unknown = new Response(
      JSON.stringify({
        request_id: "secret-request-value",
        custom_blob: { opaque_field: "must-not-appear" },
      }),
      { headers: { "content-type": "application/json" } },
    )

    await expect(consumeAiChatResponse(html, () => undefined)).rejects.toThrow(
      "Provider 返回了 HTML 页面",
    )

    let diagnostic = ""
    try {
      await consumeAiChatResponse(unknown, () => undefined)
    } catch (error) {
      diagnostic = error instanceof Error ? error.message : String(error)
    }
    expect(diagnostic).toContain("content-type=application/json")
    expect(diagnostic).toContain("request_id:string")
    expect(diagnostic).not.toContain("secret-request-value")
    expect(diagnostic).not.toContain("must-not-appear")
  })
})
