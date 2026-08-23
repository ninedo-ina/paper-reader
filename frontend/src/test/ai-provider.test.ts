import { describe, expect, it, vi } from "vitest"
import {
  buildProviderHeaders,
  buildProviderBaseUrlCandidates,
  extractModelIds,
  normalizeProviderBaseUrl,
  requestAiChatCompletion,
  testAiProviderConnection,
} from "@/lib/ai-provider"

describe("normalizeProviderBaseUrl", () => {
  it("normalizes trailing slashes and full endpoint URLs", () => {
    expect(normalizeProviderBaseUrl(" https://example.com/v1/// ")).toBe("https://example.com/v1")
    expect(normalizeProviderBaseUrl("https://example.com/v1/chat/completions")).toBe("https://example.com/v1")
    expect(normalizeProviderBaseUrl("https://example.com/v1/models")).toBe("https://example.com/v1")
  })
})

describe("buildProviderBaseUrlCandidates", () => {
  it("keeps the configured endpoint first and adds /v1 only when needed", () => {
    expect(buildProviderBaseUrlCandidates("https://provider.example")).toEqual([
      "https://provider.example",
      "https://provider.example/v1",
    ])
    expect(buildProviderBaseUrlCandidates("https://provider.example/api/v1")).toEqual([
      "https://provider.example/api/v1",
    ])
  })

  it("adds /v1 before a query string", () => {
    expect(buildProviderBaseUrlCandidates("https://provider.example/api?region=cn")).toEqual([
      "https://provider.example/api?region=cn",
      "https://provider.example/api/v1?region=cn",
    ])
  })
})

describe("buildProviderHeaders", () => {
  it("omits an empty authorization header", () => {
    expect(buildProviderHeaders("", true)).toEqual({ "Content-Type": "application/json" })
  })
})

describe("extractModelIds", () => {
  it("supports common OpenAI-compatible model response shapes", () => {
    expect(extractModelIds({ data: [{ id: "model-a" }, { id: "model-b" }] })).toEqual([
      "model-a",
      "model-b",
    ])
    expect(extractModelIds({ models: [{ name: "model-c" }, "model-d"] })).toEqual([
      "model-c",
      "model-d",
    ])
  })
})

describe("testAiProviderConnection", () => {
  it("tests chat directly when a model is already configured", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        'data: {"choices":[{"delta":{"content":"OK"}}]}\n\ndata: [DONE]\n',
        { status: 200, headers: { "content-type": "text/event-stream" } },
      ),
    )

    const result = await testAiProviderConnection(
      {
        baseUrl: "https://provider.example/v1",
        apiKey: "secret-key",
        models: ["working-model"],
      },
      fetchMock,
    )

    expect(result).toEqual({ ok: true, message: "连接成功，模型 working-model 可用" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://provider.example/v1/chat/completions")
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: "working-model",
      stream: true,
    })
  })

  it("discovers a model before testing chat when the model list is empty", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ id: "discovered-model" }] }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )

    const result = await testAiProviderConnection(
      {
        baseUrl: "https://provider.example/v1",
        apiKey: "secret-key",
        models: [],
      },
      fetchMock,
    )

    expect(result).toEqual({
      ok: true,
      message: "连接成功，已获取 1 个模型并验证 discovered-model",
      models: ["discovered-model"],
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("reports the real chat error and redacts the API key", async () => {
    const apiKey = "sk-super-secret-key"
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: `Invalid model; received Bearer ${apiKey}` } }),
        { status: 400 },
      ),
    )

    const result = await testAiProviderConnection(
      {
        baseUrl: "https://provider.example/v1",
        apiKey,
        models: ["bad-model"],
      },
      fetchMock,
    )

    expect(result.ok).toBe(false)
    expect(result.message).toContain("对话接口测试失败")
    expect(result.message).toContain("HTTP 400")
    expect(result.message).not.toContain(apiKey)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("does not guess gpt-4o-mini when model discovery fails", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "models unavailable" } }), { status: 404 }),
    )

    const result = await testAiProviderConnection(
      {
        baseUrl: "https://provider.example/v1",
        apiKey: "secret-key",
        models: [],
      },
      fetchMock,
    )

    expect(result.ok).toBe(false)
    expect(result.message).toContain("请先手动填写一个该 Provider 支持的模型")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe("requestAiChatCompletion", () => {
  it("can request a non-streaming completion without an automatic retry", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "简洁标题" } }] }), {
        headers: { "content-type": "application/json" },
      }),
    )

    await expect(
      requestAiChatCompletion({
        baseUrl: "https://provider.example/v1",
        apiKey: "secret-key",
        model: "working-model",
        messages: [{ role: "user", content: "生成标题" }],
        onContent: () => undefined,
        stream: false,
        fetchImpl: fetchMock,
      }),
    ).resolves.toBe("简洁标题")

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      stream: false,
    })
  })

  it("retries once without streaming when a successful stream has no text", async () => {
    const updates: string[] = []
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response('data: {"choices":[{"finish_reason":"stop"}]}\n\ndata: [DONE]\n', {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { choices: [{ message: { content: "非流式兜底成功" } }] },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      )

    await expect(
      requestAiChatCompletion({
        baseUrl: "https://provider.example/v1",
        apiKey: "secret-key",
        model: "working-model",
        messages: [{ role: "user", content: "测试" }],
        onContent: (content) => updates.push(content),
        fetchImpl: fetchMock,
      }),
    ).resolves.toBe("非流式兜底成功")

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      stream: true,
    })
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      stream: false,
    })
    expect(updates).toEqual(["非流式兜底成功"])
  })

  it("does not retry an HTTP failure", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "unauthorized" } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    )

    await expect(
      requestAiChatCompletion({
        baseUrl: "https://provider.example",
        apiKey: "secret-key",
        model: "working-model",
        messages: [{ role: "user", content: "测试" }],
        onContent: () => undefined,
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow("HTTP 401")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("falls back to /v1 when the configured endpoint returns HTML", async () => {
    const resolvedBaseUrls: string[] = []
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response("<html><body>Provider portal</body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      )
      .mockResolvedValueOnce(
        new Response('data: {"choices":[{"delta":{"content":"/v1 成功"}}]}\n\ndata: [DONE]\n', {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
      )

    await expect(
      requestAiChatCompletion({
        baseUrl: "https://provider.example",
        apiKey: "secret-key",
        model: "working-model",
        messages: [{ role: "user", content: "测试" }],
        onContent: () => undefined,
        onBaseUrlResolved: (baseUrl) => resolvedBaseUrls.push(baseUrl),
        fetchImpl: fetchMock,
      }),
    ).resolves.toBe("/v1 成功")

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://provider.example/chat/completions",
      "https://provider.example/v1/chat/completions",
    ])
    expect(resolvedBaseUrls).toEqual(["https://provider.example/v1"])
  })

  it.each([404, 405])("falls back to /v1 for HTTP %s endpoint errors", async (status) => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "route not found" }), { status }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: "回退成功" } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )

    await expect(
      requestAiChatCompletion({
        baseUrl: "https://provider.example",
        apiKey: "secret-key",
        model: "working-model",
        messages: [{ role: "user", content: "测试" }],
        onContent: () => undefined,
        fetchImpl: fetchMock,
      }),
    ).resolves.toBe("回退成功")

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://provider.example/v1/chat/completions",
    )
  })

  it("combines value-free diagnostics when both response modes are empty", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          'data: {"id":"stream-secret","choices":[{"finish_reason":"stop"}]}\n\ndata: [DONE]\n',
          { headers: { "content-type": "text/event-stream" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            request_id: "fallback-secret",
            result: { metadata_only: true },
          }),
          { headers: { "content-type": "application/json" } },
        ),
      )

    let message = ""
    try {
      await requestAiChatCompletion({
        baseUrl: "https://provider.example/v1",
        apiKey: "secret-key",
        model: "working-model",
        messages: [{ role: "user", content: "测试" }],
        onContent: () => undefined,
        fetchImpl: fetchMock,
      })
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(message).toContain("流式和非流式响应都没有可显示文本")
    expect(message).toContain("stream={content-type=text/event-stream")
    expect(message).toContain("non-stream={content-type=application/json")
    expect(message).not.toContain("stream-secret")
    expect(message).not.toContain("fallback-secret")
  })

  it("keeps full safe diagnostics in the connection-test result", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response("data: [DONE]\n", {
          headers: { "content-type": "text/event-stream" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ metadata_only: true }), {
          headers: { "content-type": "application/json" },
        }),
      )

    const result = await testAiProviderConnection(
      {
        baseUrl: "https://provider.example/v1",
        apiKey: "secret-key",
        models: ["working-model"],
      },
      fetchMock,
    )

    expect(result.ok).toBe(false)
    expect(result.message).toContain("stream={content-type=text/event-stream")
    expect(result.message).toContain("non-stream={content-type=application/json")
  })

  it("returns the corrected Base URL after a successful /v1 fallback", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response("<html><body>Portal</body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )

    const result = await testAiProviderConnection(
      {
        baseUrl: "https://provider.example",
        apiKey: "secret-key",
        models: ["working-model"],
      },
      fetchMock,
    )

    expect(result).toEqual({
      ok: true,
      message: "连接成功，模型 working-model 可用，已自动补全 Base URL 的 /v1 API 路径",
      baseUrl: "https://provider.example/v1",
    })
  })

  it("uses /v1/models when model discovery receives an HTML page", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response("<html><body>Portal</body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ id: "discovered-model" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )

    const result = await testAiProviderConnection(
      {
        baseUrl: "https://provider.example",
        apiKey: "secret-key",
        models: [],
      },
      fetchMock,
    )

    expect(result.baseUrl).toBe("https://provider.example/v1")
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://provider.example/models",
      "https://provider.example/v1/models",
      "https://provider.example/v1/chat/completions",
    ])
  })
})
