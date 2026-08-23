import {
  consumeAiChatResponse,
  EmptyAiResponseError,
  isEmptyAiResponseError,
  isProviderEndpointMismatchError,
  ProviderEndpointMismatchError,
} from "@/lib/ai-chat-response"

export interface TestableAiProvider {
  baseUrl: string
  apiKey: string
  models: string[]
}

export interface AiProviderTestResult {
  ok: boolean
  message: string
  models?: string[]
  baseUrl?: string
}

type FetchLike = typeof fetch

export interface AiChatCompletionMessage {
  role: "user" | "assistant" | "system"
  content: string
}

interface AiChatCompletionOptions {
  baseUrl: string
  apiKey: string
  model: string
  messages: AiChatCompletionMessage[]
  onContent: (content: string) => void
  onBaseUrlResolved?: (baseUrl: string) => void
  fetchImpl?: FetchLike
}

export function normalizeProviderBaseUrl(value: string): string {
  return value
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/(?:chat\/completions|models)$/i, "")
}

export function buildProviderBaseUrlCandidates(value: string): string[] {
  const baseUrl = normalizeProviderBaseUrl(value)
  if (!baseUrl) return [baseUrl]

  try {
    const url = new URL(baseUrl)
    const hasV1Path = url.pathname
      .split("/")
      .some((segment) => segment.toLowerCase() === "v1")
    if (hasV1Path) return [baseUrl]

    const pathname = url.pathname.replace(/\/+$/, "")
    url.pathname = `${pathname}/v1`
    return [baseUrl, url.toString()]
  } catch {
    if (/\/v1$/i.test(baseUrl)) return [baseUrl]
    return [baseUrl, `${baseUrl}/v1`]
  }
}

function buildProviderEndpointUrl(baseUrl: string, endpoint: string): string {
  try {
    const url = new URL(baseUrl)
    const pathname = url.pathname.replace(/\/+$/, "")
    url.pathname = `${pathname}/${endpoint.replace(/^\/+/, "")}`
    return url.toString()
  } catch {
    return `${baseUrl.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`
  }
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

export function redactProviderErrorText(value: string, apiKey: string): string {
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

function looksLikeHtmlResponse(response: Response, body: string): boolean {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""
  return /text\/html|application\/xhtml\+xml/i.test(contentType) || /^\s*</.test(body)
}

async function createProviderHttpError(
  response: Response,
  apiKey: string,
): Promise<Error> {
  let body = ""
  try {
    body = await response.text()
  } catch {
    // Some providers close the body before it can be read.
  }

  if (looksLikeHtmlResponse(response, body)) {
    return new ProviderEndpointMismatchError(
      `HTTP ${response.status}：Provider 返回了 HTML 页面而不是模型响应`,
    )
  }

  const detail = redactProviderErrorText(extractErrorMessage(body), apiKey)
  const message = `HTTP ${response.status}${detail ? `：${detail}` : ""}`
  if (response.status === 404 || response.status === 405) {
    return new ProviderEndpointMismatchError(message)
  }
  return new Error(message)
}

export async function describeProviderHttpError(response: Response, apiKey: string): Promise<string> {
  return (await createProviderHttpError(response, apiKey)).message
}

export function describeProviderNetworkError(error: unknown): string {
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

export async function requestAiChatCompletion({
  baseUrl: configuredBaseUrl,
  apiKey,
  model,
  messages,
  onContent,
  onBaseUrlResolved,
  fetchImpl = fetch,
}: AiChatCompletionOptions): Promise<string> {
  const baseUrl = normalizeProviderBaseUrl(configuredBaseUrl)
  const baseUrlError = validateBaseUrl(baseUrl)
  if (baseUrlError) throw new Error(baseUrlError)

  const requestAtBaseUrl = async (candidateBaseUrl: string): Promise<string> => {
    const request = async (stream: boolean) => {
      const response = await fetchImpl(
        buildProviderEndpointUrl(candidateBaseUrl, "chat/completions"),
        {
          method: "POST",
          headers: buildProviderHeaders(apiKey, true),
          body: JSON.stringify({ model, messages, stream }),
        },
      )

      if (!response.ok) throw await createProviderHttpError(response, apiKey)
      return consumeAiChatResponse(response, onContent)
    }

    try {
      return await request(true)
    } catch (error) {
      if (!isEmptyAiResponseError(error)) throw error
      try {
        return await request(false)
      } catch (fallbackError) {
        if (!isEmptyAiResponseError(fallbackError)) throw fallbackError
        throw new EmptyAiResponseError(
          `stream={${error.diagnostic}}; non-stream={${fallbackError.diagnostic}}`,
          "Provider 的流式和非流式响应都没有可显示文本",
        )
      }
    }
  }

  const candidates = buildProviderBaseUrlCandidates(baseUrl)
  for (let index = 0; index < candidates.length; index += 1) {
    const candidateBaseUrl = candidates[index]
    try {
      const content = await requestAtBaseUrl(candidateBaseUrl)
      onBaseUrlResolved?.(candidateBaseUrl)
      return content
    } catch (error) {
      const hasFallback = index < candidates.length - 1
      if (hasFallback && isProviderEndpointMismatchError(error)) continue
      throw error
    }
  }

  throw new ProviderEndpointMismatchError()
}

async function fetchProviderModels(
  configuredBaseUrl: string,
  apiKey: string,
  fetchImpl: FetchLike,
): Promise<{ models: string[]; baseUrl?: string; error?: string }> {
  const candidates = buildProviderBaseUrlCandidates(configuredBaseUrl)

  for (let index = 0; index < candidates.length; index += 1) {
    const baseUrl = candidates[index]
    try {
      const response = await fetchImpl(buildProviderEndpointUrl(baseUrl, "models"), {
        headers: buildProviderHeaders(apiKey),
      })

      if (!response.ok) {
        const error = await createProviderHttpError(response, apiKey)
        if (index < candidates.length - 1 && isProviderEndpointMismatchError(error)) continue
        return { models: [], error: error.message }
      }

      let body = ""
      try {
        body = await response.text()
      } catch {
        return { models: [], error: "模型接口响应无法读取" }
      }

      if (looksLikeHtmlResponse(response, body)) {
        if (index < candidates.length - 1) continue
        return { models: [], error: "模型接口返回了 HTML 页面而不是模型列表" }
      }

      let payload: unknown
      try {
        payload = JSON.parse(body)
      } catch {
        return { models: [], error: "模型接口返回的不是有效 JSON" }
      }

      const models = extractModelIds(payload)
      if (models.length === 0) {
        return { models: [], error: "模型接口响应中没有可识别的模型 ID" }
      }

      return { models, baseUrl }
    } catch (error) {
      return { models: [], error: describeProviderNetworkError(error) }
    }
  }

  return { models: [], error: "模型接口未命中可用的 API 路径" }
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
  let preferredBaseUrl = baseUrl

  if (models.length === 0) {
    const discovery = await fetchProviderModels(baseUrl, provider.apiKey, fetchImpl)
    models = discovery.models
    preferredBaseUrl = discovery.baseUrl ?? baseUrl

    if (models.length === 0) {
      return {
        ok: false,
        message: `无法确定测试模型：${discovery.error ?? "模型列表为空"}。请先手动填写一个该 Provider 支持的模型`,
      }
    }
  }

  const model = models[0]
  let resolvedBaseUrl = preferredBaseUrl
  try {
    await requestAiChatCompletion({
      baseUrl: preferredBaseUrl,
      apiKey: provider.apiKey,
      model,
      messages: [{ role: "user", content: "Reply with OK." }],
      onContent: () => undefined,
      onBaseUrlResolved: (value) => {
        resolvedBaseUrl = value
      },
      fetchImpl,
    })

    const correctedBaseUrl = resolvedBaseUrl !== baseUrl ? resolvedBaseUrl : undefined
    const correctionMessage = correctedBaseUrl
      ? "，已自动补全 Base URL 的 /v1 API 路径"
      : ""
    return {
      ok: true,
      message:
        configuredModels.length > 0
          ? `连接成功，模型 ${model} 可用${correctionMessage}`
          : `连接成功，已获取 ${models.length} 个模型并验证 ${model}${correctionMessage}`,
      models: configuredModels.length > 0 ? undefined : models,
      baseUrl: correctedBaseUrl,
    }
  } catch (error) {
    const detail = error instanceof EmptyAiResponseError
      ? error.message
      : redactProviderErrorText(describeProviderNetworkError(error), provider.apiKey)
    return {
      ok: false,
      message: `对话接口测试失败（模型 ${model}）：${detail}`,
    }
  }
}
