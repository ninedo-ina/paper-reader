import { describe, expect, it, vi } from "vitest"
import {
  buildProviderHeaders,
  extractModelIds,
  normalizeProviderBaseUrl,
  testAiProviderConnection,
} from "@/lib/ai-provider"

describe("normalizeProviderBaseUrl", () => {
  it("normalizes trailing slashes and full endpoint URLs", () => {
    expect(normalizeProviderBaseUrl(" https://example.com/v1/// ")).toBe("https://example.com/v1")
    expect(normalizeProviderBaseUrl("https://example.com/v1/chat/completions")).toBe("https://example.com/v1")
    expect(normalizeProviderBaseUrl("https://example.com/v1/models")).toBe("https://example.com/v1")
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
      new Response(JSON.stringify({ choices: [] }), { status: 200 }),
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
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [] }), { status: 200 }))

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
