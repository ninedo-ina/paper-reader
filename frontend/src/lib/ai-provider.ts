import {
  consumeAiChatResponseDetailed,
  type AiChatResponseResult,
  EmptyAiResponseError,
  isEmptyAiResponseError,
  isProviderEndpointMismatchError,
  ProviderEndpointMismatchError,
} from "@/lib/ai-chat-response"
import { requestRaw } from "@/lib/api/client"
import { runtimeTranslator } from "@/i18n/runtime"

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
type RelayFetchLike = (path: string, options?: RequestInit) => Promise<Response>

export interface AiChatCompletionMessage {
  role: "user" | "assistant" | "system"
  content: string
}

export interface AiChatCompletionOptions {
  baseUrl: string
  apiKey: string
  model: string
  messages: AiChatCompletionMessage[]
  onContent: (content: string) => void
  onReasoning?: (reasoning: string) => void
  onBaseUrlResolved?: (baseUrl: string) => void
  stream?: boolean
  fetchImpl?: FetchLike
  relayFetchImpl?: RelayFetchLike
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
  if (!value.trim()) return runtimeTranslator("errors")("providerNoDetail")

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
  const t = runtimeTranslator("errors")
  let body = ""
  try {
    body = await response.text()
  } catch {
    // Some providers close the body before it can be read.
  }

  if (looksLikeHtmlResponse(response, body)) {
    return new ProviderEndpointMismatchError(
      t("httpHtmlResponse", { status: response.status }),
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
  const t = runtimeTranslator("errors")
  const message = error instanceof Error ? error.message : String(error)

  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return t("providerUnreachable")
  }
  if (/abort/i.test(message)) return t("providerAborted")
  return message || t("unknownNetwork")
}

function validateBaseUrl(baseUrl: string): string | null {
  const t = runtimeTranslator("errors")
  try {
    const url = new URL(baseUrl)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return t("baseUrlScheme")
    }
    if (typeof window !== "undefined" && window.location.protocol === "https:" && url.protocol === "http:") {
      return t("baseUrlMixedContent")
    }
    return null
  } catch {
    return t("baseUrlInvalid")
  }
}

function isProviderNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /failed to fetch|networkerror|network request failed|load failed|cors/i.test(message)
}

function defaultRelayFetch(path: string, options?: RequestInit): Promise<Response> {
  return requestRaw(path, options)
}

async function requestProviderRelayDetailed(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: AiChatCompletionMessage[],
  stream: boolean,
  relayFetch: RelayFetchLike,
  onContent: (content: string) => void,
  onReasoning?: (reasoning: string) => void,
): Promise<AiChatResponseResult> {
  const response = await relayFetch("/provider-relay/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ baseUrl, apiKey, model, messages, stream }),
  })

  if (!response.ok) throw await createProviderHttpError(response, apiKey)
  return consumeAiChatResponseDetailed(response, { onContent, onReasoning })
}

export async function requestAiChatCompletionDetailed({
  baseUrl: configuredBaseUrl,
  apiKey,
  model,
  messages,
  onContent,
  onReasoning,
  onBaseUrlResolved,
  stream: useStreaming = true,
  fetchImpl = fetch,
  relayFetchImpl,
}: AiChatCompletionOptions): Promise<AiChatResponseResult> {
  const baseUrl = normalizeProviderBaseUrl(configuredBaseUrl)
  const baseUrlError = validateBaseUrl(baseUrl)
  if (baseUrlError) throw new Error(baseUrlError)

  const relayFetch = relayFetchImpl ?? (fetchImpl === fetch ? defaultRelayFetch : undefined)

  const requestAtBaseUrl = async (
    candidateBaseUrl: string,
    viaRelay = false,
  ): Promise<AiChatResponseResult> => {
    const request = async (stream: boolean) => {
      if (viaRelay) {
        if (!relayFetch) throw new Error(runtimeTranslator("errors")("relayUnavailable"))
        return requestProviderRelayDetailed(
          candidateBaseUrl,
          apiKey,
          model,
          messages,
          stream,
          relayFetch,
          onContent,
          onReasoning,
        )
      }

      const response = await fetchImpl(
        buildProviderEndpointUrl(candidateBaseUrl, "chat/completions"),
        {
          method: "POST",
          headers: buildProviderHeaders(apiKey, true),
          body: JSON.stringify({ model, messages, stream }),
        },
      )

      if (!response.ok) throw await createProviderHttpError(response, apiKey)
      return consumeAiChatResponseDetailed(response, { onContent, onReasoning })
    }

    if (!useStreaming) return request(false)

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
          runtimeTranslator("errors")("noDisplayText"),
        )
      }
    }
  }

  const candidates = buildProviderBaseUrlCandidates(baseUrl)
  let lastNetworkError: unknown = null
  for (let index = 0; index < candidates.length; index += 1) {
    const candidateBaseUrl = candidates[index]
    try {
      const content = await requestAtBaseUrl(candidateBaseUrl)
      onBaseUrlResolved?.(candidateBaseUrl)
      return content
    } catch (error) {
      const hasFallback = index < candidates.length - 1
      if (hasFallback && isProviderEndpointMismatchError(error)) continue
      if (isProviderNetworkError(error)) {
        lastNetworkError = error
        if (hasFallback) continue
        break
      }
      throw error
    }
  }

  if (relayFetch && lastNetworkError) {
    for (let index = 0; index < candidates.length; index += 1) {
      try {
        const content = await requestAtBaseUrl(candidates[index], true)
        onBaseUrlResolved?.(candidates[index])
        return content
      } catch (error) {
        if (index < candidates.length - 1 && isProviderEndpointMismatchError(error)) continue
        throw error
      }
    }
  }

  throw lastNetworkError ?? new ProviderEndpointMismatchError()
}

export async function requestAiChatCompletion(
  options: AiChatCompletionOptions,
): Promise<string> {
  const result = await requestAiChatCompletionDetailed(options)
  return result.content || result.reasoning
}

async function fetchProviderModels(
  configuredBaseUrl: string,
  apiKey: string,
  fetchImpl: FetchLike,
): Promise<{ models: string[]; baseUrl?: string; error?: string }> {
  const candidates = buildProviderBaseUrlCandidates(configuredBaseUrl)
  const relayFetch = fetchImpl === fetch ? defaultRelayFetch : undefined
  let lastNetworkError: unknown = null

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
        return { models: [], error: runtimeTranslator("errors")("modelsUnreadable") }
      }

      if (looksLikeHtmlResponse(response, body)) {
        if (index < candidates.length - 1) continue
        return { models: [], error: runtimeTranslator("errors")("modelsHtml") }
      }

      let payload: unknown
      try {
        payload = JSON.parse(body)
      } catch {
        return { models: [], error: runtimeTranslator("errors")("modelsNotJson") }
      }

      const models = extractModelIds(payload)
      if (models.length === 0) {
        return { models: [], error: runtimeTranslator("errors")("modelsNoId") }
      }

      return { models, baseUrl }
    } catch (error) {
      if (isProviderNetworkError(error)) {
        lastNetworkError = error
        continue
      }
      return { models: [], error: describeProviderNetworkError(error) }
    }
  }

  if (relayFetch && lastNetworkError) {
    for (let index = 0; index < candidates.length; index += 1) {
      const baseUrl = candidates[index]
      try {
        const response = await relayFetch("/provider-relay/models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ baseUrl, apiKey }),
        })

        if (!response.ok) {
          const error = await createProviderHttpError(response, apiKey)
          if (index < candidates.length - 1 && isProviderEndpointMismatchError(error)) continue
          return { models: [], error: error.message }
        }

        const body = await response.text()
        if (looksLikeHtmlResponse(response, body)) {
          if (index < candidates.length - 1) continue
          return { models: [], error: runtimeTranslator("errors")("modelsHtml") }
        }

        let payload: unknown
        try {
          payload = JSON.parse(body)
        } catch {
          return { models: [], error: runtimeTranslator("errors")("modelsNotJson") }
        }

        const models = extractModelIds(payload)
        if (models.length === 0) {
          return { models: [], error: runtimeTranslator("errors")("modelsNoId") }
        }
        return { models, baseUrl }
      } catch (error) {
        if (isProviderNetworkError(error)) continue
        return { models: [], error: describeProviderNetworkError(error) }
      }
    }
  }

  return {
    models: [],
    error: lastNetworkError
      ? describeProviderNetworkError(lastNetworkError)
      : runtimeTranslator("errors")("modelsNoPath"),
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
  let preferredBaseUrl = baseUrl

  if (models.length === 0) {
    const discovery = await fetchProviderModels(baseUrl, provider.apiKey, fetchImpl)
    models = discovery.models
    preferredBaseUrl = discovery.baseUrl ?? baseUrl

    if (models.length === 0) {
      return {
        ok: false,
        message: runtimeTranslator("errors")("providerTestNoModel", {
          detail: discovery.error ?? runtimeTranslator("errors")("modelsEmpty"),
        }),
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
      ? runtimeTranslator("errors")("baseUrlAutofixed")
      : ""
    return {
      ok: true,
      message:
        configuredModels.length > 0
          ? runtimeTranslator("errors")("providerTestOkModel", { model, correction: correctionMessage })
          : runtimeTranslator("errors")("providerTestOkList", {
              count: models.length,
              model,
              correction: correctionMessage,
            }),
      models: configuredModels.length > 0 ? undefined : models,
      baseUrl: correctedBaseUrl,
    }
  } catch (error) {
    const detail = error instanceof EmptyAiResponseError
      ? error.message
      : redactProviderErrorText(describeProviderNetworkError(error), provider.apiKey)
    return {
      ok: false,
      message: runtimeTranslator("errors")("providerTestChatFailed", { model, detail }),
    }
  }
}
