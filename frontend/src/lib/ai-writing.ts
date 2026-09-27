import type { Editor, JSONContent } from "@tiptap/react"
import { isEmptyAiResponseError } from "@/lib/ai-chat-response"
import {
  describeProviderNetworkError,
  redactProviderErrorText,
  requestAiChatCompletion,
  type AiChatCompletionMessage,
} from "@/lib/ai-provider"
import { uniqueCslItems, type CslItem, type CslItemType, type CslName } from "@/lib/citations"

/**
 * W8 AI 写作：把「读论文问 AI」扩到「写论文问 AI」。
 *
 * 复用现有 Provider 主链路 —— Provider 仍取 `preferences-store` 里用户自己配的那一份，
 * 请求仍走 `lib/ai-provider` 的 `requestAiChatCompletion`，服务端不新增任何模型配置。
 *
 * 红线：正文、选区与 Prompt 只发往用户自己配置的 Provider，本模块不做任何日志输出；
 * 抛给 UI 的错误一律经 `describeAiWritingError` 脱敏。
 */

export type AiWritingActionId =
  | "continue"
  | "rewrite"
  | "translate"
  | "paraphrase"
  | "abstract"
  | "grammar"
  | "reference"

/** 建议的落地方式：改写原选区 / 在光标后插入 / 只读报告 / 回写参考文献表 */
export type AiWritingResultKind = "replace" | "insert" | "report" | "references"

export interface AiWritingActionMeta {
  id: AiWritingActionId
  resultKind: AiWritingResultKind
  /** 必须先在正文里选中一段文字 */
  needsSelection: boolean
  /** 需要通读整篇正文 */
  needsDocument: boolean
}

export const AI_WRITING_ACTIONS: readonly AiWritingActionMeta[] = [
  { id: "continue", resultKind: "insert", needsSelection: true, needsDocument: false },
  { id: "rewrite", resultKind: "replace", needsSelection: true, needsDocument: false },
  { id: "translate", resultKind: "replace", needsSelection: true, needsDocument: false },
  { id: "paraphrase", resultKind: "replace", needsSelection: true, needsDocument: false },
  { id: "abstract", resultKind: "insert", needsSelection: false, needsDocument: true },
  { id: "grammar", resultKind: "report", needsSelection: false, needsDocument: true },
  { id: "reference", resultKind: "references", needsSelection: false, needsDocument: false },
]

export function aiWritingActionMeta(id: AiWritingActionId): AiWritingActionMeta {
  const meta = AI_WRITING_ACTIONS.find((action) => action.id === id)
  if (!meta) throw new Error(`unknown ai writing action: ${id}`)
  return meta
}

/** 翻译目标语言用语言自称，避免为 14 种界面语言各加一套选项文案。 */
export const AI_WRITING_TRANSLATE_TARGETS = [
  "中文",
  "English",
  "日本語",
  "한국어",
  "Français",
  "Deutsch",
  "Español",
  "Русский",
] as const

export const DEFAULT_TRANSLATE_TARGET = AI_WRITING_TRANSLATE_TARGETS[0]

/** Provider 侧上下文有限，超长正文保留首尾两段：结论通常在尾部，砍掉尾段会毁掉摘要质量。 */
const DOCUMENT_HEAD_LIMIT = 16000
const DOCUMENT_TAIL_LIMIT = 8000

export function clipDocumentText(text: string): string {
  const value = text.trim()
  if (value.length <= DOCUMENT_HEAD_LIMIT + DOCUMENT_TAIL_LIMIT) return value
  return `${value.slice(0, DOCUMENT_HEAD_LIMIT)}\n……\n${value.slice(-DOCUMENT_TAIL_LIMIT)}`
}

export interface AiWritingInput {
  action: AiWritingActionId
  /** 用户选区纯文本（续写/改写/翻译/降重必填） */
  selection: string
  /** 整篇正文纯文本（摘要生成、语法检查用；发送前按 head+tail 截断） */
  document: string
  /** 翻译目标语言 */
  targetLanguage?: string
  /** 参考文献表当前条目（reference 用） */
  entries?: CslItem[]
}

export interface AiWritingTarget {
  baseUrl: string
  apiKey: string
  model: string
}

/** 实际会随请求发出的正文范围，用于在 UI 上明确告知用户「发了什么、发给谁」。 */
export type AiWritingPayloadScope = "selection" | "document" | "references"

export interface AiWritingDisclosure {
  scope: AiWritingPayloadScope
  /** 会随请求发出的正文字符数；references 不含正文，为 0 */
  characters: number
}

export function describeAiWritingDisclosure(
  action: AiWritingActionId,
  selection: string,
  document: string,
): AiWritingDisclosure {
  const meta = aiWritingActionMeta(action)
  if (meta.resultKind === "references") return { scope: "references", characters: 0 }
  if (meta.needsDocument) return { scope: "document", characters: clipDocumentText(document).length }
  return { scope: "selection", characters: selection.length }
}

export function providerHostLabel(baseUrl: string): string {
  try {
    return new URL(baseUrl.trim()).host
  } catch {
    return baseUrl.trim()
  }
}

function systemPrompt(action: AiWritingActionId, targetLanguage: string): string {
  switch (action) {
    case "continue":
      return "你是学术论文写作助手。根据用户给出的已有正文续写后文：保持相同的语言、人称、术语与学术语体，只承接后续内容，不要复述已有正文。只输出续写的正文，不要标题、解释、前缀后缀、Markdown 标记或引号。"
    case "rewrite":
      return "你是学术论文写作助手。改写用户选中的学术文本，使表达更准确、简洁、符合学术写作规范；必须保持原意、原语言、数据与引用标记不变。只输出改写后的文本，不要解释、不要 Markdown 标记、不要引号。"
    case "translate":
      return `你是学术论文翻译。把用户选中的文本翻译成${targetLanguage}，保持学术语体与专业术语一致，不增删信息。只输出译文，不要解释、不要 Markdown 标记、不要引号。`
    case "paraphrase":
      return "你是学术论文写作助手。对用户选中的文本做降重改写：在保持原意、数据、专业术语与引用标记不变的前提下更换句式与措辞，降低与原文的字面重合度。只输出降重后的文本，不要解释、不要 Markdown 标记、不要引号。"
    case "abstract":
      return "你是学术论文写作助手。根据用户提供的论文正文写一段摘要：涵盖研究问题、方法、主要结果与结论，语言必须与正文语言一致。只输出摘要正文，不要出现「摘要」字样、不要关键词、不要解释、不要 Markdown 标记。"
    case "grammar":
      return "你是学术论文的语言校对。检查用户提供的论文文本中的语法错误、标点问题与不恰当的学术用语。逐条输出，每条一行，格式为「原文片段 → 问题 → 建议改法」，最多 10 条并按重要性排序；问题不足时不要凑数。作答语言必须与正文语言一致。只输出清单本身，不要前言、总结或 Markdown 标记。"
    case "reference":
      return "你是参考文献格式助手。用户会给出一个 CSL-JSON 数组。请检查每条记录的字段完整性（作者、标题、年份、期刊或出版方、卷期页码、DOI/URL），修正明显错误（作者姓名拆分、年份格式、标题大小写），并补齐能从现有记录推断出的字段。禁止编造无法推断的信息，禁止增删条目，每条记录的 id 必须原样保留。只输出修正后的 CSL-JSON 数组本身，不要包成对象、不要 Markdown 代码块、不要解释。"
  }
}

function userPrompt(input: AiWritingInput): string {
  switch (input.action) {
    case "continue":
      return `已有正文：\n${input.selection}\n\n请接着往下写。`
    case "rewrite":
      return `需要改写的文本：\n${input.selection}`
    case "translate":
      return `需要翻译的文本：\n${input.selection}`
    case "paraphrase":
      return `需要降重的文本：\n${input.selection}`
    case "abstract":
      return `论文正文：\n${clipDocumentText(input.document)}`
    case "grammar":
      return `论文正文：\n${clipDocumentText(input.document)}`
    case "reference":
      return `当前参考文献表（CSL-JSON）：\n${JSON.stringify(input.entries ?? [])}`
  }
}

export function buildAiWritingMessages(input: AiWritingInput): AiChatCompletionMessage[] {
  const targetLanguage = input.targetLanguage?.trim() || DEFAULT_TRANSLATE_TARGET
  return [
    { role: "system", content: systemPrompt(input.action, targetLanguage) },
    { role: "user", content: userPrompt(input) },
  ]
}

export async function requestAiWriting(
  input: AiWritingInput,
  target: AiWritingTarget,
  options?: { onBaseUrlResolved?: (baseUrl: string) => void },
): Promise<string> {
  return requestAiChatCompletion({
    baseUrl: target.baseUrl,
    apiKey: target.apiKey,
    model: target.model,
    messages: buildAiWritingMessages(input),
    onContent: () => undefined,
    onBaseUrlResolved: options?.onBaseUrlResolved,
    stream: false,
  })
}

export function describeAiWritingError(error: unknown, apiKey: string): string {
  if (isEmptyAiResponseError(error)) return error.message
  return redactProviderErrorText(describeProviderNetworkError(error), apiKey)
}

/** 模型偶尔仍会套一层代码块，这里只剥掉「整段被包住」的那一种，不做其它改写。 */
export function cleanAiWritingText(value: string): string {
  const trimmed = value.trim()
  const fenced = trimmed.match(/^```[a-zA-Z]*\r?\n([\s\S]*?)\r?\n?```$/)
  return (fenced ? fenced[1] : trimmed).trim()
}

const CSL_ITEM_TYPES: readonly CslItemType[] = [
  "article-journal",
  "paper-conference",
  "book",
  "chapter",
  "thesis",
  "report",
  "article",
  "webpage",
]

const CSL_STRING_FIELDS = [
  "title",
  "container-title",
  "volume",
  "issue",
  "page",
  "publisher",
  "DOI",
  "URL",
] as const

function copyCslNames(raw: unknown): CslName[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const names = raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null
      const record = entry as Record<string, unknown>
      const name: CslName = {}
      for (const key of ["family", "given", "literal"] as const) {
        const value = record[key]
        if (typeof value === "string" && value.trim()) name[key] = value.trim()
      }
      return Object.keys(name).length ? name : null
    })
    .filter((name): name is CslName => name !== null)
  return names.length ? names : undefined
}

function copyCslIssued(raw: unknown): { "date-parts": number[][] } | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const parts = (raw as Record<string, unknown>)["date-parts"]
  if (!Array.isArray(parts) || !Array.isArray(parts[0])) return undefined
  const numbers = parts[0]
    .map((value) => Number.parseInt(String(value), 10))
    .filter((value) => Number.isFinite(value))
  return numbers.length ? { "date-parts": [numbers] } : undefined
}

/** 只收 CSL 子集里认得的字段：Provider 多塞的键不进文档数据。 */
function toCslItem(raw: unknown): CslItem | null {
  if (!raw || typeof raw !== "object") return null
  const record = raw as Record<string, unknown>
  const id = typeof record.id === "string" ? record.id.trim() : ""
  if (!id) return null

  const type =
    typeof record.type === "string" && (CSL_ITEM_TYPES as readonly string[]).includes(record.type)
      ? (record.type as CslItemType)
      : "article"

  const item: CslItem = { id, type }
  for (const field of CSL_STRING_FIELDS) {
    const value = record[field]
    if (typeof value === "string" && value.trim()) item[field] = value.trim()
  }

  const author = copyCslNames(record.author)
  if (author) item.author = author
  const issued = copyCslIssued(record.issued)
  if (issued) item.issued = issued

  return item
}

function extractJsonText(value: string): string | null {
  const body = cleanAiWritingText(value)
  const start = body.indexOf("[")
  const end = body.lastIndexOf("]")
  if (start >= 0 && end > start) return body.slice(start, end + 1)
  const braceStart = body.indexOf("{")
  const braceEnd = body.lastIndexOf("}")
  if (braceStart >= 0 && braceEnd > braceStart) return `[${body.slice(braceStart, braceEnd + 1)}]`
  return null
}

/** 参考文献建议的解析是容错的：模型偶发包代码块或单条不加数组，都按同一条路径收下来。 */
export function parseCslItems(value: string): CslItem[] | null {
  const body = extractJsonText(value)
  if (!body) return null
  try {
    const payload: unknown = JSON.parse(body)
    if (!Array.isArray(payload)) return null
    const items = uniqueCslItems(
      payload.map(toCslItem).filter((item): item is CslItem => item !== null),
    )
    return items.length ? items : null
  } catch {
    return null
  }
}

/** 回写文献表前必须确认条目集合没变：少一条就会让正文里的引用标记失去落点。 */
export function sameCslIdSet(current: CslItem[], proposed: CslItem[]): boolean {
  if (current.length !== proposed.length) return false
  const ids = new Set(current.map((item) => item.id))
  return proposed.every((item) => ids.has(item.id))
}

export function aiWritingSelectionText(editor: Editor): string {
  const { from, to } = editor.state.selection
  return editor.state.doc.textBetween(from, to, "\n")
}

/** 生成期间用户可能改了正文，届时原选区坐标已经失效，不能再往上写。 */
export function isAiWritingRangeStale(
  editor: Editor,
  range: { from: number; to: number },
  sourceText: string,
): boolean {
  return editor.state.doc.textBetween(range.from, range.to, "\n") !== sourceText
}

/** Provider 返回的是多行纯文本，一行落一个段落；放不成段落的空行直接丢掉。 */
export function suggestionParagraphs(text: string): JSONContent[] {
  return text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ type: "paragraph", content: [{ type: "text", text: line }] }))
}

/**
 * 建议写入正文。这是需求里「不能直接改用户的字」的最后一环 —— 只有用户点确认才会走到这里。
 *
 * insert 落在当前块的下一块，避免在半句中间插入块级内容把段落劈成两半；
 * replace 若选中范围在同一段落内且建议只有一段，就按行内文本替换，保住原有段落结构。
 */
export function applyAiWritingSuggestion(
  editor: Editor,
  resultKind: AiWritingResultKind,
  range: { from: number; to: number },
  text: string,
): boolean {
  const paragraphs = suggestionParagraphs(text)
  if (!paragraphs.length) return false

  if (resultKind === "insert") {
    const $to = editor.state.doc.resolve(range.to)
    const at = $to.depth > 0 ? $to.after($to.depth) : $to.pos
    editor.chain().focus().insertContentAt(at, paragraphs).run()
    return true
  }

  const sameBlock =
    editor.state.doc.resolve(range.from).parent === editor.state.doc.resolve(range.to).parent
  const content =
    paragraphs.length === 1 && sameBlock ? (paragraphs[0].content ?? []) : paragraphs
  editor.chain().focus().insertContentAt({ from: range.from, to: range.to }, content).run()
  return true
}
