export interface TestableAiProvider {
  baseUrl: string
  apiKey: string
  models: string[]
}

export interface AiProviderTestResult {
  ok: boolean
  message: string
  models?: string[]
}

type FetchLike = typeof fetch

export function normalizeProviderBaseUrl(value: string): string {
  return value
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/(?:chat\/completions|models)$/i, "")
}

export function buildProviderHeaders(apiKey: string, includeJson = false): Record<string, string> {
  const headers: Record<string, string> = {}
  const key = apiKey.trim()

  if (includeJson) headers["Content-Type"] = "application/json"
  if (key) headers.Authorization = `Bearer ${key}`

  return headers
}

export function extractModelIds(payload: unknown): string[] {
  let entries: unknown[] = []

  if (Array.isArray(payload)) {
    entries = payload
  } else if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>
    if (Array.isArray(record.data)) entries = record.data
    else if (Array.isArray(record.models)) entries = record.models
  }

  return Array.from(
    new Set(
      entries
        .map((entry) => {
          if (typeof entry === "string") return entry.trim()
          if (!entry || typeof entry !== "object") return ""
          const model = entry as Record<string, unknown>
          const value = model.id ?? model.name ?? model.model
          return typeof value === "string" ? value.trim() : ""
        })
        .filter(Boolean),
    ),
  )
}

function redactSensitiveText(value: string, apiKey: string): string {
  let redacted = value
  const key = apiKey.trim()

  if (key) redacted = redacted.split(key).join("[REDACTED]")

  return redacted
    .replace(/Bearer\s+[^\s,"']+/gi, "Bearer [REDACTED]")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "sk-[REDACTED]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240)
}

function extractErrorMessage(value: string): string {
  if (!value.trim()) return "Provider 未返回错误详情"

  try {
    const payload = JSON.parse(value) as Record<string, unknown>
    const error = payload.error

    if (typeof error === "string") return error
    if (error && typeof error === "object") {
      const message = (error as Record<string, unknown>).message
      if (typeof message === "string") return message
    }
    if (typeof payload.message === "string") return payload.message
    if (typeof payload.detail === "string") return payload.detail
  } catch {
    // Plain-text and HTML error bodies are handled below.
  }

  return value
}

async function describeHttpError(response: Response, apiKey: string): Promise<string> {
  let body = ""
  try {
    body = await response.text()
  } catch {
    // Some providers close the body before it can be read.
  }

  const detail = redactSensitiveText(extractErrorMessage(body), apiKey)
  return `HTTP ${response.status}${detail ? `：${detail}` : ""}`
}

function describeNetworkError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "浏览器无法访问 Provider；请检查 Base URL、CORS、TLS 证书以及 HTTPS 页面是否请求了 HTTP 地址"
  }
  if (/abort/i.test(message)) return "请求已中止或超时"
  return message || "未知网络错误"
}

function validateBaseUrl(baseUrl: string): string | null {
  try {
    const url = new URL(baseUrl)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "Base URL 只支持 http:// 或 https://"
    }
    if (typeof window !== "undefined" && window.location.protocol === "https:" && url.protocol === "http:") {
      return "当前页面是 HTTPS，浏览器会阻止请求 HTTP Provider（Mixed Content）"
    }
    return null
  } catch {
    return "Base URL 格式无效"
  }
}

async function fetchProviderModels(
  baseUrl: string,
  apiKey: string,
  fetchImpl: FetchLike,
): Promise<{ models: string[]; error?: string }> {
  try {
    const response = await fetchImpl(`${baseUrl}/models`, {
      headers: buildProviderHeaders(apiKey),
    })

    if (!response.ok) {
      return { models: [], error: await describeHttpError(response, apiKey) }
    }

    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      return { models: [], error: "模型接口返回的不是有效 JSON" }
    }

    const models = extractModelIds(payload)
    if (models.length === 0) {
      return { models: [], error: "模型接口响应中没有可识别的模型 ID" }
    }

    return { models }
  } catch (error) {
    return { models: [], error: describeNetworkError(error) }
  }
}

export async function testAiProviderConnection(
  provider: TestableAiProvider,
  fetchImpl: FetchLike = fetch,
): Promise<AiProviderTestResult> {
  const baseUrl = normalizeProviderBaseUrl(provider.baseUrl)
  const baseUrlError = validateBaseUrl(baseUrl)
  if (baseUrlError) return { ok: false, message: baseUrlError }

  const configuredModels = Array.from(
    new Set(provider.models.map((model) => model.trim()).filter(Boolean)),
  )
  let models = configuredModels

  if (models.length === 0) {
    const discovery = await fetchProviderModels(baseUrl, provider.apiKey, fetchImpl)
    models = discovery.models

    if (models.length === 0) {
      return {
        ok: false,
        message: `无法确定测试模型：${discovery.error ?? "模型列表为空"}。请先手动填写一个该 Provider 支持的模型`,
      }
    }
  }

  const model = models[0]
  try {
    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: buildProviderHeaders(provider.apiKey, true),
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Reply with OK." }],
        stream: true,
      }),
    })

    if (!response.ok) {
      return {
        ok: false,
        message: `对话接口测试失败（模型 ${model}）：${await describeHttpError(response, provider.apiKey)}`,
      }
    }

    try {
      await response.body?.cancel()
    } catch {
      // The connection is already verified once response headers are available.
    }

    return {
      ok: true,
      message:
        configuredModels.length > 0
          ? `连接成功，模型 ${model} 可用`
          : `连接成功，已获取 ${models.length} 个模型并验证 ${model}`,
      models: configuredModels.length > 0 ? undefined : models,
    }
  } catch (error) {
    return {
      ok: false,
      message: `对话接口请求失败：${describeNetworkError(error)}`,
    }
  }
}
