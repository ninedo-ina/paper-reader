import type { PaperDetailDto } from "@/lib/api/types"

/**
 * CSL-JSON 子集。字段名严格沿用 CSL 规范（`container-title`、`date-parts` 这类带连字符的名字也是），
 * 这样将来换成真正的 CSL 处理器（citeproc / citation-js）时数据不用改，只需要替换下面的格式化函数。
 * 本轮不引入 citation-js：它要带 CSL 样式与 locale 资源，打包摩擦大，而 W4 只需要"编号能重排 + 能点回文献"。
 */
export type CslItemType =
  | "article-journal"
  | "paper-conference"
  | "book"
  | "chapter"
  | "thesis"
  | "report"
  | "article"
  | "webpage"

export interface CslName {
  family?: string
  given?: string
  /** 机构作者等无法拆成姓/名的情形 */
  literal?: string
}

export interface CslItem {
  id: string
  type: CslItemType
  title?: string
  author?: CslName[]
  issued?: { "date-parts": number[][] }
  "container-title"?: string
  volume?: string
  issue?: string
  page?: string
  publisher?: string
  DOI?: string
  URL?: string
}

/**
 * 能被引用的论文：PaperDetailDto 与 PaperListDto 都满足（列表接口不返回 sourceUrl/extraFields，
 * 那两项本来就是可选的）。引用面板只查列表，不必为每条候选多打一次详情接口。
 */
export interface CitablePaper {
  id: number
  title: string
  authors?: string
  doi?: string
  year?: string
  journal?: string
  sourceUrl?: string
  extraFields?: Record<string, unknown>
}

/** 引用节点的 refId 与参考文献表条目的 id 用同一套标识，DOI 优先（跨论文唯一）。 */
export function referenceIdForPaper(paper: Pick<PaperDetailDto, "id" | "doi">): string {
  const doi = paper.doi?.trim()
  if (doi) return `doi:${doi.toLowerCase()}`
  return `paper:${paper.id}`
}

function parseName(raw: string): CslName | null {
  const value = raw.trim().replace(/\.$/, "")
  if (!value) return null

  const comma = value.indexOf(",")
  if (comma > 0) {
    const family = value.slice(0, comma).trim()
    const given = value.slice(comma + 1).trim()
    if (!family) return null
    return given ? { family, given } : { family }
  }

  const parts = value.split(/\s+/)
  if (parts.length === 1) return { literal: value }
  return { family: parts[parts.length - 1], given: parts.slice(0, -1).join(" ") }
}

/** 论文的 authors 是一个自由文本字段，可能是 "Smith, John; Doe, Jane"，也可能是 "John Smith and Jane Doe"。 */
export function parseAuthorList(raw?: string): CslName[] {
  if (!raw?.trim()) return []
  return raw
    .replace(/\s+and\s+/gi, ";")
    .replace(/；/g, ";")
    .split(";")
    .map(parseName)
    .filter((name): name is CslName => name !== null)
}

function inferCslType(paper: CitablePaper): CslItemType {
  if (paper.journal?.trim()) return "article-journal"
  const publicationType = paper.extraFields?.publicationType
  if (typeof publicationType === "string" && /conference|proceedings/i.test(publicationType)) {
    return "paper-conference"
  }
  if (paper.extraFields?.arxivId || paper.sourceUrl?.includes("arxiv.org")) return "article"
  if (paper.sourceUrl?.trim()) return "webpage"
  return "article"
}

function extraFieldString(paper: CitablePaper, key: string): string | undefined {
  const value = paper.extraFields?.[key]
  if (value == null || value === "") return undefined
  return String(value)
}

/**
 * 复用已有的 DOI/arXiv 元数据补全结果：期刊、卷期页码、出版社、arXiv 编号都写在 extraFields 里，
 * 不再重复请求 /api/papers/{id}/metadata/*。
 */
export function paperToCslItem(paper: CitablePaper): CslItem {
  const item: CslItem = {
    id: referenceIdForPaper(paper),
    type: inferCslType(paper),
    title: paper.title,
  }

  const authors = parseAuthorList(paper.authors)
  if (authors.length) item.author = authors

  const year = Number.parseInt(paper.year ?? "", 10)
  if (Number.isFinite(year)) item.issued = { "date-parts": [[year]] }

  const journal = paper.journal?.trim()
  if (journal) item["container-title"] = journal

  const volume = extraFieldString(paper, "volume")
  if (volume) item.volume = volume
  const issue = extraFieldString(paper, "issue")
  if (issue) item.issue = issue
  const page = extraFieldString(paper, "publicationPages") ?? extraFieldString(paper, "pages")
  if (page) item.page = page
  const publisher = extraFieldString(paper, "publisher")
  if (publisher) item.publisher = publisher

  const doi = paper.doi?.trim()
  if (doi) item.DOI = doi
  const url = paper.sourceUrl?.trim()
  if (url && /^https?:\/\//i.test(url)) item.URL = url

  return item
}

/** 手动录入一条文献（库里没有这条论文时的兜底），标识优先用 DOI，否则退化成标题。 */
export function manualCslItem(input: {
  title: string
  authors?: string
  year?: string
  doi?: string
  url?: string
  containerTitle?: string
}): CslItem {
  const doi = input.doi?.trim()
  const title = input.title.trim()
  const item: CslItem = {
    id: doi ? `doi:${doi.toLowerCase()}` : `manual:${title.toLowerCase()}`,
    type: input.containerTitle?.trim() ? "article-journal" : "article",
    title,
  }

  const authors = parseAuthorList(input.authors)
  if (authors.length) item.author = authors

  const year = Number.parseInt(input.year ?? "", 10)
  if (Number.isFinite(year)) item.issued = { "date-parts": [[year]] }

  const container = input.containerTitle?.trim()
  if (container) item["container-title"] = container
  if (doi) item.DOI = doi
  const url = input.url?.trim()
  if (url && /^https?:\/\//i.test(url)) item.URL = url

  return item
}

/** 参考文献表的排序键：先按条目 id 去重，编号由此顺序推导。 */
export function uniqueCslItems(items: CslItem[]): CslItem[] {
  const seen = new Set<string>()
  const result: CslItem[] = []
  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue
    seen.add(item.id)
    result.push(item)
  }
  return result
}

export function cslYear(item: CslItem): number | undefined {
  return item.issued?.["date-parts"]?.[0]?.[0]
}

export function formatName(name: CslName): string {
  if (name.literal) return name.literal
  const family = name.family?.trim() ?? ""
  const given = name.given?.trim() ?? ""
  if (!family) return given
  if (!given) return family
  const initials = given
    .split(/[\s.\-]+/)
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}.`)
    .join(" ")
  return `${family} ${initials}`
}

function ellipsis(locale: string): string {
  return /^(zh|ja|ko)/i.test(locale) ? "等" : "et al."
}

export function formatAuthorList(names: CslName[] | undefined, locale = "en", max = 3): string {
  if (!names?.length) return ""
  const formatted = names.map(formatName).filter(Boolean)
  if (formatted.length <= max) return formatted.join(", ")
  return `${formatted.slice(0, max).join(", ")} ${ellipsis(locale)}`
}

function formatVenue(item: CslItem): string {
  const parts: string[] = []
  if (item["container-title"]) parts.push(item["container-title"])
  if (item.publisher) parts.push(item.publisher)
  let text = parts.join(", ")
  if (item.volume) text += `${text ? " " : ""}${item.volume}`
  if (item.issue) text += `(${item.issue})`
  if (item.page) text += `: ${item.page}`
  return text
}

/**
 * CSL 样式的接入点：换真 CSL 模板时只改这一个函数，节点属性与编号逻辑都不用动。
 * 当前是内置的最小数字制格式（作者. 标题 (年). 期刊 卷(期): 页. DOI: xx）。
 */
export function formatBibliographyEntry(item: CslItem, locale = "en"): string {
  const segments: string[] = []

  const authors = formatAuthorList(item.author, locale)
  if (authors) segments.push(authors)

  const year = cslYear(item)
  const title = item.title?.trim()
  if (title && year) segments.push(`${title} (${year})`)
  else if (title) segments.push(title)
  else if (year) segments.push(String(year))

  const venue = formatVenue(item)
  if (venue) segments.push(venue)

  const link = item.DOI ? `DOI: ${item.DOI}` : item.URL
  if (link) segments.push(link)

  const text = segments.join(". ").replace(/\s+/g, " ").trim()
  if (!text) return ""
  return text.endsWith(".") ? text : `${text}.`
}

/** "点回文献"的落地目标；没有可解析的外部地址时返回 undefined，条目就不渲染成链接。 */
export function referenceUrl(item: CslItem): string | undefined {
  const doi = item.DOI?.trim()
  if (doi) return `https://doi.org/${encodeURI(doi)}`
  const url = item.URL?.trim()
  if (url && /^https?:\/\//i.test(url)) return url
  return undefined
}
