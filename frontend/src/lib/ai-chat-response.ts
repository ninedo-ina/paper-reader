export const EMPTY_AI_RESPONSE_MESSAGE =
  "Provider 返回成功，但响应中没有可显示的文本。已兼容流式与非流式响应，请确认所选模型支持 /chat/completions 并会返回文本内容"

export class EmptyAiResponseError extends Error {
  constructor(message = EMPTY_AI_RESPONSE_MESSAGE) {
    super(message)
    this.name = "EmptyAiResponseError"
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
  updates: TextUpdate[]
}

const MAX_NESTING_DEPTH = 8

function textFromContent(value: unknown, depth = 0): string {
  if (depth > MAX_NESTING_DEPTH) return ""
  if (typeof value === "string") return value

  if (Array.isArray(value)) {
    return value.map((part) => textFromContent(part, depth + 1)).join("")
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    for (const key of ["text", "content", "parts", "value", "output_text"]) {
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

function parseJsonUpdates(value: string, depth = 0): JsonParseResult {
  try {
    return {
      parsed: true,
      updates: extractTextUpdates(JSON.parse(value), depth + 1),
    }
  } catch {
    return { parsed: false, updates: [] }
  }
}

function extractTextUpdates(payload: unknown, depth = 0): TextUpdate[] {
  if (depth > MAX_NESTING_DEPTH) return []

  if (Array.isArray(payload)) {
    return payload.flatMap((item) => extractTextUpdates(item, depth + 1))
  }

  if (typeof payload === "string") {
    const trimmed = payload.trim()
    if ((trimmed.startsWith("{") || trimmed.startsWith("[")) && depth < MAX_NESTING_DEPTH) {
      const nested = parseJsonUpdates(trimmed, depth + 1)
      if (nested.parsed) return nested.updates
    }
    return payload ? [{ text: payload, mode: "replace", channel: "content" }] : []
  }

  if (!payload || typeof payload !== "object") return []

  const record = payload as Record<string, unknown>
  const choices = Array.isArray(record.choices) ? record.choices : []
  const firstChoice = choices[0]

  if (firstChoice && typeof firstChoice === "object") {
    const choice = firstChoice as Record<string, unknown>
    const delta = choice.delta

    if (delta && typeof delta === "object") {
      const deltaRecord = delta as Record<string, unknown>
      const updates = compactUpdates([
        createFirstUpdate(
          [
            deltaRecord.reasoning_content,
            deltaRecord.reasoning_text,
            deltaRecord.reasoning,
          ],
          "append",
          "reasoning",
        ),
        createFirstUpdate([deltaRecord.content, deltaRecord.text], "append"),
      ])
      if (updates.length > 0) return updates
    } else if (typeof delta === "string" && delta) {
      return [{ text: delta, mode: "append", channel: "content" }]
    }

    if (choice.message) {
      const message = choice.message
      if (typeof message === "object") {
        const messageRecord = message as Record<string, unknown>
        const updates = compactUpdates([
          createFirstUpdate(
            [
              messageRecord.reasoning_content,
              messageRecord.reasoning_text,
              messageRecord.reasoning,
            ],
            "replace",
            "reasoning",
          ),
          createFirstUpdate([messageRecord.content, messageRecord.text], "replace"),
        ])
        if (updates.length > 0) return updates
      } else {
        const update = createUpdate(message, "replace")
        if (update) return [update]
      }
    }

    const choiceText = createUpdate(choice.text, "append")
    if (choiceText) return [choiceText]
  }

  const type = typeof record.type === "string" ? record.type : ""
  if (typeof record.delta === "string") {
    if (/(?:output_)?text\.delta/i.test(type)) {
      return [{ text: record.delta, mode: "append", channel: "content" }]
    }
    if (/reasoning.*delta/i.test(type)) {
      return [{ text: record.delta, mode: "append", channel: "reasoning" }]
    }
  }

  if (record.delta && typeof record.delta === "object") {
    const delta = record.delta as Record<string, unknown>
    const updates = compactUpdates([
      createFirstUpdate(
        [delta.reasoning_content, delta.reasoning_text, delta.reasoning],
        "append",
        "reasoning",
      ),
      createFirstUpdate([delta.content, delta.text], "append"),
    ])
    if (updates.length > 0) return updates
  }

  if (record.content_block_delta && typeof record.content_block_delta === "object") {
    const block = record.content_block_delta as Record<string, unknown>
    const blockDelta = block.delta
    if (blockDelta && typeof blockDelta === "object") {
      const delta = blockDelta as Record<string, unknown>
      const updates = compactUpdates([
        createFirstUpdate([delta.reasoning, delta.thinking], "append", "reasoning"),
        createFirstUpdate([delta.content, delta.text], "append"),
      ])
      if (updates.length > 0) return updates
    }
  }

  const candidates = Array.isArray(record.candidates) ? record.candidates : []
  const firstCandidate = candidates[0]
  if (firstCandidate && typeof firstCandidate === "object") {
    const candidate = firstCandidate as Record<string, unknown>
    const candidateText = createFirstUpdate([candidate.content, candidate.text], "append")
    if (candidateText) return [candidateText]
  }

  const outputText = createUpdate(record.output_text, "replace")
  if (outputText) return [outputText]

  const output = createUpdate(record.output, "replace")
  if (output) return [output]

  for (const key of ["data", "result", "response", "payload", "body"]) {
    const nested = record[key]
    if (nested === undefined || nested === null) continue

    if (typeof nested === "string") {
      const trimmed = nested.trim()
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        const parsed = parseJsonUpdates(trimmed, depth + 1)
        if (parsed.parsed && parsed.updates.length > 0) return parsed.updates
      } else if (trimmed) {
        return [{ text: nested, mode: "replace", channel: "content" }]
      }
      continue
    }

    const nestedUpdates = extractTextUpdates(nested, depth + 1)
    if (nestedUpdates.length > 0) return nestedUpdates
  }

  if (record.message) {
    if (typeof record.message === "object") {
      const message = record.message as Record<string, unknown>
      const updates = compactUpdates([
        createFirstUpdate(
          [message.reasoning_content, message.reasoning_text, message.reasoning],
          "replace",
          "reasoning",
        ),
        createFirstUpdate([message.content, message.text], "replace"),
      ])
      if (updates.length > 0) return updates
    } else {
      const messageText = createUpdate(record.message, "replace")
      if (messageText) return [messageText]
    }
  }

  const directText = compactUpdates([
    createUpdate(record.content, "replace"),
    createUpdate(record.completion, "replace"),
    createUpdate(record.answer, "replace"),
    createUpdate(record.text, "replace"),
  ])
  if (directText.length > 0) return directText.slice(0, 1)

  const reasoning = createFirstUpdate(
    [record.reasoning_content, record.reasoning_text, record.reasoning],
    "replace",
    "reasoning",
  )
  return reasoning ? [reasoning] : []
}

export async function consumeAiChatResponse(
  response: Response,
  onContent: (content: string) => void,
): Promise<string> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""
  let content = ""
  let reasoning = ""

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

  const applyUpdates = (updates: TextUpdate[]) => updates.forEach(applyUpdate)
  const reader = response.body?.getReader()
  if (!reader) throw new EmptyAiResponseError("Provider 响应中没有可读取的内容")

  const decoder = new TextDecoder()
  let buffer = ""
  let rawResponse = ""
  let sseDataLines: string[] = []

  const processSsePayload = (value: string): boolean => {
    const data = value.trim()
    if (!data || data === "[DONE]") return true

    const parsed = parseJsonUpdates(data)
    if (parsed.parsed) {
      applyUpdates(parsed.updates)
      return true
    }

    if (!data.startsWith("{") && !data.startsWith("[")) {
      applyUpdate({ text: value, mode: "append", channel: "content" })
      return true
    }

    return false
  }

  const flushSseData = () => {
    if (sseDataLines.length === 0) return
    processSsePayload(sseDataLines.join("\n"))
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
        const pending = parseJsonUpdates(sseDataLines.join("\n"))
        if (pending.parsed) {
          applyUpdates(pending.updates)
          sseDataLines = []
        }
      }
      sseDataLines.push(data)
      return
    }

    if (/^(?:event|id|retry):/i.test(trimmed)) return

    flushSseData()
    const parsed = parseJsonUpdates(trimmed)
    if (parsed.parsed) applyUpdates(parsed.updates)
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const decoded = decoder.decode(value, { stream: true })
    rawResponse += decoded
    buffer += decoded

    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ""
    lines.forEach(processLine)
  }

  const tail = decoder.decode()
  rawResponse += tail
  buffer += tail
  if (buffer) processLine(buffer)
  flushSseData()

  if (!content.trim() && !reasoning.trim()) {
    const parsed = parseJsonUpdates(rawResponse.trim())
    if (parsed.parsed) applyUpdates(parsed.updates)
  }

  if (!content.trim() && !reasoning.trim() && /text\/(?:plain|markdown)/i.test(contentType)) {
    const plainText = rawResponse.trim()
    if (plainText && !plainText.startsWith("data:")) {
      applyUpdate({ text: plainText, mode: "replace", channel: "content" })
    }
  }

  if (!content.trim() && reasoning.trim()) {
    content = reasoning
    onContent(content)
  }

  if (!content.trim()) throw new EmptyAiResponseError()
  return content
}
