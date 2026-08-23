export const EMPTY_AI_RESPONSE_MESSAGE =
  "Provider 返回成功，但响应中没有可显示的文本。请确认所选模型支持 OpenAI 兼容的 /chat/completions 输出格式"

type TextUpdateMode = "append" | "replace"

interface TextUpdate {
  text: string
  mode: TextUpdateMode
}

function textFromContent(value: unknown): string {
  if (typeof value === "string") return value

  if (Array.isArray(value)) {
    return value
      .map((part) => {
        if (typeof part === "string") return part
        if (!part || typeof part !== "object") return ""

        const record = part as Record<string, unknown>
        if (typeof record.text === "string") return record.text
        if (typeof record.content === "string") return record.content
        return ""
      })
      .join("")
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    if (typeof record.text === "string") return record.text
    if (typeof record.content === "string") return record.content
  }

  return ""
}

function extractTextUpdate(payload: unknown): TextUpdate | null {
  if (!payload || typeof payload !== "object") return null

  const record = payload as Record<string, unknown>
  const choices = Array.isArray(record.choices) ? record.choices : []
  const firstChoice = choices[0]

  if (firstChoice && typeof firstChoice === "object") {
    const choice = firstChoice as Record<string, unknown>
    const delta = choice.delta

    if (delta && typeof delta === "object") {
      const deltaRecord = delta as Record<string, unknown>
      const deltaText = textFromContent(deltaRecord.content ?? deltaRecord.text)
      if (deltaText) return { text: deltaText, mode: "append" }
    } else if (typeof delta === "string" && delta) {
      return { text: delta, mode: "append" }
    }

    const choiceText = textFromContent(choice.text)
    if (choiceText) return { text: choiceText, mode: "append" }

    if (choice.message && typeof choice.message === "object") {
      const message = choice.message as Record<string, unknown>
      const messageText = textFromContent(message.content)
      if (messageText) return { text: messageText, mode: "replace" }
    }
  }

  const type = typeof record.type === "string" ? record.type : ""
  if (typeof record.delta === "string" && /(?:output_)?text\.delta/i.test(type)) {
    return { text: record.delta, mode: "append" }
  }

  if (record.delta && typeof record.delta === "object") {
    const deltaText = textFromContent((record.delta as Record<string, unknown>).text)
    if (deltaText) return { text: deltaText, mode: "append" }
  }

  if (record.content_block_delta && typeof record.content_block_delta === "object") {
    const block = record.content_block_delta as Record<string, unknown>
    const blockDelta = block.delta
    if (blockDelta && typeof blockDelta === "object") {
      const blockText = textFromContent((blockDelta as Record<string, unknown>).text)
      if (blockText) return { text: blockText, mode: "append" }
    }
  }

  const outputText = textFromContent(record.output_text)
  if (outputText) return { text: outputText, mode: "replace" }

  const topLevelContent = textFromContent(record.content)
  if (topLevelContent) return { text: topLevelContent, mode: "replace" }

  const responseText = textFromContent(record.response)
  if (responseText) return { text: responseText, mode: "replace" }

  const candidates = Array.isArray(record.candidates) ? record.candidates : []
  const firstCandidate = candidates[0]
  if (firstCandidate && typeof firstCandidate === "object") {
    const candidate = firstCandidate as Record<string, unknown>
    const content = candidate.content
    if (content && typeof content === "object") {
      const parts = (content as Record<string, unknown>).parts
      const candidateText = textFromContent(parts)
      if (candidateText) return { text: candidateText, mode: "append" }
    }
  }

  return null
}

function parseJsonUpdate(value: string): TextUpdate | null {
  try {
    return extractTextUpdate(JSON.parse(value))
  } catch {
    return null
  }
}

export async function consumeAiChatResponse(
  response: Response,
  onContent: (content: string) => void,
): Promise<string> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""
  let content = ""

  const applyUpdate = (update: TextUpdate | null) => {
    if (!update?.text) return

    const nextContent = update.mode === "append" ? content + update.text : update.text
    if (nextContent === content) return

    content = nextContent
    if (content.trim()) onContent(content)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error("Provider 响应中没有可读取的内容")

  const decoder = new TextDecoder()
  let buffer = ""
  let rawResponse = ""

  const processLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith(":")) return

    if (trimmed.startsWith("data:")) {
      const data = trimmed.slice(5).trimStart()
      if (!data || data === "[DONE]") return
      applyUpdate(parseJsonUpdate(data))
      return
    }

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      applyUpdate(parseJsonUpdate(trimmed))
    }
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

  if (!content.trim()) {
    applyUpdate(parseJsonUpdate(rawResponse.trim()))
  }

  if (!content.trim() && contentType.includes("text/plain")) {
    const plainText = rawResponse.trim()
    if (plainText && !plainText.startsWith("data:")) {
      applyUpdate({ text: plainText, mode: "replace" })
    }
  }

  if (!content.trim()) throw new Error(EMPTY_AI_RESPONSE_MESSAGE)
  return content
}
