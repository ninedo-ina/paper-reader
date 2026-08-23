export const EMPTY_AI_RESPONSE_MESSAGE =
  "Provider 返回成功，但响应中没有可显示的文本"

export class EmptyAiResponseError extends Error {
  readonly diagnostic: string

  constructor(diagnostic = "", message = EMPTY_AI_RESPONSE_MESSAGE) {
    super(diagnostic ? `${message}。响应诊断：${diagnostic}` : message)
    this.name = "EmptyAiResponseError"
    this.diagnostic = diagnostic
  }
}

export function isEmptyAiResponseError(error: unknown): error is EmptyAiResponseError {
  return error instanceof EmptyAiResponseError ||
    (error instanceof Error && error.name === "EmptyAiResponseError")
}

type TextUpdateMode = "append" | "replace"
type TextUpdateChannel = "content" | "reasoning"

interface TextUpdate {
  text: string
  mode: TextUpdateMode
  channel: TextUpdateChannel
}

interface JsonParseResult {
  parsed: boolean
  payloads: unknown[]
  updates: TextUpdate[]
}

const MAX_NESTING_DEPTH = 10
const MAX_DIAGNOSTIC_LENGTH = 360
const STATUS_ONLY_TEXT = /^(?:ok|success|successful|done|completed|accepted|请求成功|成功|已完成)$/i
const NON_OUTPUT_CONTAINER =
  /^(?:error|errors|usage|metadata|request|input|prompt|parameters|config|headers|tool_calls?|tools?|function_calls?|functions?)$/i
const METADATA_FIELD =
  /^(?:id|.*_id|id_.*|model|object|role|status|status_code|code|created|created_at|timestamp|index|type|name|finish_reason|finishReason|response_format|system_fingerprint)$/i
const TEXT_FIELD =
  /(?:text|content|answer|reply|response|completion|output|message|delta|token|generation|result|value|part|final)/i

function textFromContent(value: unknown, depth = 0): string {
  if (depth > MAX_NESTING_DEPTH) return ""
  if (typeof value === "string") return value

  if (Array.isArray(value)) {
    return value.map((part) => textFromContent(part, depth + 1)).join("")
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    for (const key of [
      "text",
      "value",
      "content",
      "parts",
      "output_text",
      "generated_text",
      "answer",
      "completion",
    ]) {
      const text = textFromContent(record[key], depth + 1)
      if (text) return text
    }
  }

  return ""
}

function createUpdate(
  value: unknown,
  mode: TextUpdateMode,
  channel: TextUpdateChannel = "content",
): TextUpdate | null {
  const text = textFromContent(value)
  return text ? { text, mode, channel } : null
}

function createFirstUpdate(
  values: unknown[],
  mode: TextUpdateMode,
  channel: TextUpdateChannel = "content",
): TextUpdate | null {
  for (const value of values) {
    const update = createUpdate(value, mode, channel)
    if (update) return update
  }
  return null
}

function compactUpdates(updates: Array<TextUpdate | null>): TextUpdate[] {
  return updates.filter((update): update is TextUpdate => Boolean(update?.text))
}

function getField(
  record: Record<string, unknown>,
  ...names: string[]
): unknown {
  for (const name of names) {
    if (record[name] !== undefined) return record[name]
  }

  const normalizedNames = new Set(names.map((name) => name.toLowerCase()))
  const entry = Object.entries(record).find(([key]) =>
    normalizedNames.has(key.toLowerCase()),
  )
  return entry?.[1]
}

function splitJsonSequence(value: string): string[] {
  const items: string[] = []
  let start = -1
  let depth = 0
  let quote = ""
  let escaped = false

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]

    if (quote) {
      if (escaped) {
        escaped = false
      } else if (character === "\\") {
        escaped = true
      } else if (character === quote) {
        quote = ""
      }
      continue
    }

    if (character === '"' || character === "'") {
      quote = character
      continue
    }

    if (character === "{" || character === "[") {
      if (depth === 0) start = index
      depth += 1
      continue
    }

    if (character === "}" || character === "]") {
      depth -= 1
      if (depth === 0 && start >= 0) {
        items.push(value.slice(start, index + 1))
        start = -1
      }
    }
  }

  return depth === 0 ? items : []
}

function parseDataStreamUpdate(
  value: string,
  mode: TextUpdateMode,
): TextUpdate[] | null {
  const match = value.match(/^([0-9a-z]+):(.*)$/i)
  if (!match) return null

  const [, code, serialized] = match
  if (code !== "0") return []

  try {
    const payload = JSON.parse(serialized) as unknown
    const update = createUpdate(payload, mode)
    return update ? [update] : []
  } catch {
    return serialized ? [{ text: serialized, mode, channel: "content" }] : []
  }
}

function parseJsonUpdates(
  value: string,
  mode: TextUpdateMode = "replace",
  depth = 0,
): JsonParseResult {
  try {
    const payload = JSON.parse(value) as unknown
    return {
      parsed: true,
      payloads: [payload],
      updates: extractTextUpdates(payload, mode, depth + 1),
    }
  } catch {
    const sequence = splitJsonSequence(value)
    if (sequence.length < 2) return { parsed: false, payloads: [], updates: [] }

    const results = sequence.map((item) => parseJsonUpdates(item, "append", depth + 1))
    if (results.some((result) => !result.parsed)) {
      return { parsed: false, payloads: [], updates: [] }
    }
    return {
      parsed: true,
      payloads: results.flatMap((result) => result.payloads),
      updates: results.flatMap((result) => result.updates),
    }
  }
}

function extractChoiceUpdates(
  value: unknown,
  mode: TextUpdateMode,
  depth: number,
): TextUpdate[] {
  if (!value || typeof value !== "object") return []
  const choice = value as Record<string, unknown>
  const delta = choice.delta

  if (delta && typeof delta === "object") {
    const deltaRecord = delta as Record<string, unknown>
    const updates = compactUpdates([
      createFirstUpdate(
        [
          deltaRecord.reasoning_content,
          deltaRecord.reasoning_text,
          deltaRecord.reasoning,
          deltaRecord.thinking,
        ],
        "append",
        "reasoning",
      ),
      createFirstUpdate(
        [
          deltaRecord.content,
          deltaRecord.text,
          deltaRecord.output_text,
          deltaRecord.answer,
        ],
        "append",
      ),
    ])
    if (updates.length > 0) return updates
  } else if (typeof delta === "string" && delta) {
    return [{ text: delta, mode: "append", channel: "content" }]
  }

  for (const messageKey of ["message", "messages"]) {
    if (choice[messageKey] === undefined) continue
    const updates = extractTextUpdates(choice[messageKey], mode, depth + 1)
    if (updates.length > 0) return updates
  }

  const direct = createFirstUpdate(
    [
      choice.content,
      choice.text,
      choice.answer,
      choice.completion,
      choice.output_text,
      choice.generated_text,
    ],
    mode,
  )
  return direct ? [direct] : []
}

function hasExplicitFailure(record: Record<string, unknown>): boolean {
  for (const key of ["error", "errors", "error_message", "errorMessage"]) {
    const value = getField(record, key)
    if (typeof value === "string" && value.trim()) return true
    if (Array.isArray(value) && value.length > 0) return true
    if (value && typeof value === "object" && Object.keys(value).length > 0) return true
  }

  if (getField(record, "success") === false) return true
  const statusValue = getField(record, "status")
  const status = typeof statusValue === "string" ? statusValue : ""
  if (/^(?:error|failed|failure|blocked|rejected)$/i.test(status)) return true

  const code = getField(record, "code")
  if (typeof code === "number") return code !== 0 && code !== 200
  if (typeof code === "string" && code.trim()) {
    const normalized = code.trim()
    if (/^\d+$/.test(normalized)) {
      const numericCode = Number(normalized)
      return numericCode !== 0 && (numericCode < 200 || numericCode >= 300)
    }
    return /(?:error|fail|invalid|denied|forbidden|unauthorized|blocked|rejected)/i.test(
      normalized,
    )
  }
  return false
}

function extractTextUpdates(
  payload: unknown,
  mode: TextUpdateMode = "replace",
  depth = 0,
): TextUpdate[] {
  if (depth > MAX_NESTING_DEPTH) return []

  if (Array.isArray(payload)) {
    return payload.flatMap((item) => extractTextUpdates(item, "append", depth + 1))
  }

  if (typeof payload === "string") {
    const trimmed = payload.trim()
    if ((trimmed.startsWith("{") || trimmed.startsWith("[")) && depth < MAX_NESTING_DEPTH) {
      const nested = parseJsonUpdates(trimmed, mode, depth + 1)
      if (nested.parsed) return nested.updates
    }
    return payload ? [{ text: payload, mode, channel: "content" }] : []
  }

  if (!payload || typeof payload !== "object") return []

  const record = payload as Record<string, unknown>
  if (hasExplicitFailure(record)) return []
  const roleValue = getField(record, "role")
  const role = typeof roleValue === "string" ? roleValue.toLowerCase() : ""
  if (role === "user" || role === "system" || role === "tool" || role === "function") {
    return []
  }

  const choices = record.choices
  if (Array.isArray(choices)) {
    for (const choice of choices) {
      const updates = extractChoiceUpdates(choice, mode, depth + 1)
      if (updates.length > 0) return updates
    }
  } else if (choices && typeof choices === "object") {
    const updates = extractTextUpdates(choices, mode, depth + 1)
    if (updates.length > 0) return updates
  }

  const candidates = record.candidates
  if (Array.isArray(candidates)) {
    for (const candidate of candidates) {
      const updates = extractTextUpdates(candidate, mode, depth + 1)
      if (updates.length > 0) return updates
    }
  }

  const type = typeof record.type === "string" ? record.type : ""
  if (typeof record.delta === "string") {
    if (/(?:output[_-]?)?text[._-]?delta|content[._-]?delta/i.test(type)) {
      return [{ text: record.delta, mode: "append", channel: "content" }]
    }
    if (/reasoning[._-]?delta|thinking[._-]?delta/i.test(type)) {
      return [{ text: record.delta, mode: "append", channel: "reasoning" }]
    }
  }

  if (record.delta && typeof record.delta === "object") {
    const delta = record.delta as Record<string, unknown>
    const updates = compactUpdates([
      createFirstUpdate(
        [delta.reasoning_content, delta.reasoning_text, delta.reasoning, delta.thinking],
        "append",
        "reasoning",
      ),
      createFirstUpdate(
        [delta.content, delta.text, delta.output_text, delta.answer],
        "append",
      ),
    ])
    if (updates.length > 0) return updates
  }

  if (record.content_block_delta && typeof record.content_block_delta === "object") {
    const updates = extractTextUpdates(record.content_block_delta, "append", depth + 1)
    if (updates.length > 0) return updates
  }

  const token = createFirstUpdate(
    [record.token, record.token_text, record.tokenText],
    "append",
  )
  if (token) return [token]

  for (const wrapperKey of [
    "data",
    "result",
    "response",
    "payload",
    "body",
    "output",
    "result_data",
    "response_data",
  ]) {
    const nested = record[wrapperKey]
    if (nested === undefined || nested === null) continue

    if (typeof nested === "string") {
      const trimmed = nested.trim()
      if (STATUS_ONLY_TEXT.test(trimmed)) continue
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        const parsed = parseJsonUpdates(trimmed, mode, depth + 1)
        if (parsed.parsed && parsed.updates.length > 0) return parsed.updates
      } else if (trimmed) {
        return [{ text: nested, mode, channel: "content" }]
      }
      continue
    }

    const updates = extractTextUpdates(nested, mode, depth + 1)
    if (updates.length > 0) return updates
  }

  for (const containerKey of [
    "outputs",
    "generations",
    "completions",
    "messages",
    "message",
    "parts",
    "items",
    "results",
  ]) {
    const nested = record[containerKey]
    if (nested === undefined || nested === null) continue

    if (typeof nested === "string" && STATUS_ONLY_TEXT.test(nested.trim())) continue
    const updates = extractTextUpdates(nested, mode, depth + 1)
    if (updates.length > 0) return updates
  }

  const direct = createFirstUpdate(
    [
      record.output_text,
      record.generated_text,
      record.response_text,
      record.answer,
      record.completion,
      record.generation,
      record.reply,
      record.final,
      record.final_answer,
      record.summary_text,
      record.content,
      record.text,
    ],
    mode,
  )
  if (direct) return [direct]

  const reasoning = createFirstUpdate(
    [
      record.reasoning_content,
      record.reasoning_text,
      record.reasoning,
      record.thinking,
      record.analysis,
    ],
    mode,
    "reasoning",
  )
  if (reasoning) return [reasoning]

  for (const [key, value] of Object.entries(record)) {
    if (METADATA_FIELD.test(key) || NON_OUTPUT_CONTAINER.test(key)) continue
    if (!TEXT_FIELD.test(key)) continue

    if (typeof value === "string") {
      const text = value.trim()
      if (text && !STATUS_ONLY_TEXT.test(text)) {
        return [{ text: value, mode, channel: "content" }]
      }
      continue
    }

    const updates = extractTextUpdates(value, mode, depth + 1)
    if (updates.length > 0) return updates
  }

  for (const [key, value] of Object.entries(record)) {
    if (METADATA_FIELD.test(key) || NON_OUTPUT_CONTAINER.test(key)) continue
    if (!value || typeof value !== "object") continue

    const updates = extractTextUpdates(value, mode, depth + 1)
    if (updates.length > 0) return updates
  }

  return []
}

function stringFromErrorValue(value: unknown, depth = 0): string {
  if (depth > 4) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) {
    return value.map((item) => stringFromErrorValue(item, depth + 1)).filter(Boolean).join("; ")
  }
  if (!value || typeof value !== "object") return ""

  const record = value as Record<string, unknown>
  for (const key of ["message", "msg", "detail", "description", "reason", "type", "code"]) {
    const text = stringFromErrorValue(getField(record, key), depth + 1)
    if (text) return text
  }
  return ""
}

function findProviderProblem(payload: unknown, depth = 0): string {
  if (depth > MAX_NESTING_DEPTH || !payload || typeof payload !== "object") return ""
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const problem = findProviderProblem(item, depth + 1)
      if (problem) return problem
    }
    return ""
  }

  const record = payload as Record<string, unknown>
  for (const key of ["error", "errors", "error_message", "errorMessage"]) {
    const value = getField(record, key)
    if (value === undefined || value === null) continue
    const detail = stringFromErrorValue(value)
    return detail ? `Provider 业务错误：${detail}` : "Provider 返回了业务错误"
  }

  if (hasExplicitFailure(record)) {
    const detail = stringFromErrorValue(
      getField(record, "detail", "message", "msg", "reason", "code"),
    )
    return detail ? `Provider 业务错误：${detail}` : "Provider 返回了失败状态"
  }

  const refusal = stringFromErrorValue(getField(record, "refusal"))
  if (refusal) return `模型拒绝生成文本：${refusal}`

  const finishReason = String(getField(record, "finish_reason", "finishReason") ?? "").trim()
  if (/content[_-]?filter|safety|blocked|recitation/i.test(finishReason)) {
    return `Provider 未返回文本，结束原因：${finishReason}`
  }

  if (getField(record, "tool_calls", "toolCalls", "function_call", "functionCall")) {
    return "模型只返回了工具调用，但当前对话没有可执行工具"
  }

  for (const value of Object.values(record)) {
    const problem = findProviderProblem(value, depth + 1)
    if (problem) return problem
  }
  return ""
}

function describeShape(value: unknown, depth = 0): string {
  if (depth > 4) return "..."
  if (value === null) return "null"
  if (Array.isArray(value)) {
    const first = value.length > 0 ? describeShape(value[0], depth + 1) : "empty"
    return `array(${value.length})[${first}]`
  }
  if (typeof value !== "object") return typeof value

  const entries = Object.entries(value as Record<string, unknown>).slice(0, 10)
  const fields = entries.map(([key, fieldValue]) => `${key}:${describeShape(fieldValue, depth + 1)}`)
  const suffix = Object.keys(value as Record<string, unknown>).length > entries.length ? ",..." : ""
  return `object{${fields.join(",")}${suffix}}`
}

function buildResponseDiagnostic(
  rawResponse: string,
  contentType: string,
  payloads: unknown[],
): string {
  const bytes = new TextEncoder().encode(rawResponse).byteLength
  const type = contentType.split(";")[0] || "unknown"
  let protocol = "unrecognized"

  if (payloads.length > 0) {
    protocol = payloads.length === 1
      ? describeShape(payloads[0])
      : `events(${payloads.length})[${describeShape(payloads[0])}]`
  } else if (/^\s*</.test(rawResponse)) {
    protocol = "html-or-xml"
  } else if (/^(?:data|event):/m.test(rawResponse)) {
    protocol = "unparsed-sse"
  } else if (/^[0-9a-z]+:/im.test(rawResponse)) {
    protocol = "unparsed-data-stream"
  } else if (!rawResponse.trim()) {
    protocol = "empty-body"
  } else {
    protocol = "non-json-text"
  }

  return `content-type=${type}; bytes=${bytes}; shape=${protocol}`.slice(
    0,
    MAX_DIAGNOSTIC_LENGTH,
  )
}

export async function consumeAiChatResponse(
  response: Response,
  onContent: (content: string) => void,
): Promise<string> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""
  let content = ""
  let reasoning = ""
  const parsedPayloads: unknown[] = []

  const applyUpdate = (update: TextUpdate) => {
    const current = update.channel === "reasoning" ? reasoning : content
    const next = update.mode === "append" ? current + update.text : update.text
    if (next === current) return

    if (update.channel === "reasoning") {
      reasoning = next
      return
    }

    content = next
    if (content.trim()) onContent(content)
  }

  const applyParsed = (parsed: JsonParseResult) => {
    parsedPayloads.push(...parsed.payloads)
    parsed.updates.forEach(applyUpdate)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new EmptyAiResponseError("content-type=unknown; bytes=0; shape=missing-body")
  }

  const decoder = new TextDecoder()
  let buffer = ""
  let rawResponse = ""
  let sseDataLines: string[] = []

  const processPayload = (value: string, mode: TextUpdateMode): boolean => {
    const data = value.trim()
    if (!data || data === "[DONE]") return true

    const dataStreamUpdates = parseDataStreamUpdate(data, mode)
    if (dataStreamUpdates) {
      dataStreamUpdates.forEach(applyUpdate)
      return true
    }

    const parsed = parseJsonUpdates(data, mode)
    if (parsed.parsed) {
      applyParsed(parsed)
      return true
    }

    if (!data.startsWith("{") && !data.startsWith("[")) {
      applyUpdate({ text: value, mode, channel: "content" })
      return true
    }
    return false
  }

  const flushSseData = () => {
    if (sseDataLines.length === 0) return
    processPayload(sseDataLines.join("\n"), "append")
    sseDataLines = []
  }

  const processLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) {
      flushSseData()
      return
    }
    if (trimmed.startsWith(":")) return

    if (trimmed.startsWith("data:")) {
      const data = trimmed.slice(5).trimStart()
      if (data === "[DONE]") {
        flushSseData()
        return
      }

      if (sseDataLines.length > 0) {
        const pending = parseJsonUpdates(sseDataLines.join("\n"), "append")
        const pendingDataStream = parseDataStreamUpdate(
          sseDataLines.join("\n").trim(),
          "append",
        )
        if (pending.parsed || pendingDataStream) {
          if (pending.parsed) applyParsed(pending)
          else pendingDataStream?.forEach(applyUpdate)
          sseDataLines = []
        }
      }
      sseDataLines.push(data)
      return
    }

    if (/^(?:event|id|retry):/i.test(trimmed)) return

    flushSseData()
    const dataStreamUpdates = parseDataStreamUpdate(trimmed, "append")
    if (dataStreamUpdates) {
      dataStreamUpdates.forEach(applyUpdate)
      return
    }

    const parsed = parseJsonUpdates(trimmed, "append")
    if (parsed.parsed) applyParsed(parsed)
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const decoded = decoder.decode(value, { stream: true })
    rawResponse += decoded
    buffer += decoded

    const lines = buffer.split(/\r\n|\n|\r/)
    buffer = lines.pop() ?? ""
    lines.forEach(processLine)
  }

  const tail = decoder.decode()
  rawResponse += tail
  buffer += tail
  if (buffer) processLine(buffer)
  flushSseData()

  if (!content.trim() && !reasoning.trim()) {
    const parsed = parseJsonUpdates(rawResponse.trim(), "replace")
    if (parsed.parsed) applyParsed(parsed)
  }

  if (!content.trim() && !reasoning.trim() && /text\/(?:plain|markdown)/i.test(contentType)) {
    const plainText = rawResponse.trim()
    if (plainText && !plainText.startsWith("data:")) {
      const dataStreamUpdates = parseDataStreamUpdate(plainText, "replace")
      if (dataStreamUpdates) dataStreamUpdates.forEach(applyUpdate)
      else applyUpdate({ text: plainText, mode: "replace", channel: "content" })
    }
  }

  if (!content.trim() && !reasoning.trim()) {
    const plainText = rawResponse.trim()
    const looksStructured =
      !plainText ||
      plainText.startsWith("<") ||
      plainText.startsWith("{") ||
      plainText.startsWith("[") ||
      /^(?:data|event):/m.test(plainText) ||
      /^[0-9a-z]+:/im.test(plainText)
    if (!looksStructured) {
      applyUpdate({ text: plainText, mode: "replace", channel: "content" })
    }
  }

  if (!content.trim() && reasoning.trim()) {
    content = reasoning
    onContent(content)
  }

  if (content.trim()) return content

  for (const payload of parsedPayloads) {
    const problem = findProviderProblem(payload)
    if (problem) throw new Error(problem)
  }

  if (/text\/html|application\/xhtml\+xml/i.test(contentType) || /^\s*</.test(rawResponse)) {
    throw new Error("Provider 返回了 HTML 页面而不是模型响应，请检查 Base URL 是否指向 API 根路径")
  }

  throw new EmptyAiResponseError(
    buildResponseDiagnostic(rawResponse, contentType, parsedPayloads),
  )
}
