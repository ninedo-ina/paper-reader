export type PaperExtraFields = Record<string, unknown> | null | undefined

const LEGACY_PUBLICATION_PAGES_KEY = "pages"
const PUBLICATION_PAGES_KEY = "publicationPages"

const ENRICHMENT_KEYS = new Set([
  "arxivId",
  "arxivVersion",
  "arxivCategories",
  "arxivPrimaryCategory",
  "arxivSubmittedAt",
  "arxivUpdatedAt",
  "arxivComment",
  "repositoryDoi",
  "publicationType",
  "publicationDate",
  "volume",
  "issue",
  "publicationPages",
  "articleNumber",
  "publisher",
  "licenseUrl",
  "issn",
  "isbn",
  "dblpKey",
])

export function extraFieldValue(extraFields: PaperExtraFields, key: string): string | undefined {
  const value = extraFields?.[key]
  if (value == null || value === "") return undefined
  return String(value)
}

export function publicationPagesValue(extraFields: PaperExtraFields): string | undefined {
  return extraFieldValue(extraFields, PUBLICATION_PAGES_KEY)
    ?? extraFieldValue(extraFields, LEGACY_PUBLICATION_PAGES_KEY)
}

export function categoryExtraFieldValue(extraFields: PaperExtraFields, key: string): string {
  if (key === LEGACY_PUBLICATION_PAGES_KEY) {
    return publicationPagesValue(extraFields) ?? ""
  }
  return extraFieldValue(extraFields, key) ?? ""
}

export function toEditableExtraFields(extraFields: PaperExtraFields): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(extraFields ?? {})) {
    if (value != null) result[key] = String(value)
  }
  return result
}

export function updateCategoryExtraField(
  extraFields: Record<string, string>,
  key: string,
  value: string,
): Record<string, string> {
  if (key !== LEGACY_PUBLICATION_PAGES_KEY) {
    return { ...extraFields, [key]: value }
  }

  const next: Record<string, string> = { ...extraFields, [PUBLICATION_PAGES_KEY]: value }
  delete next[LEGACY_PUBLICATION_PAGES_KEY]
  return next
}

/** Keep provider-enriched values when a user changes the presentation category. */
export function preserveEnrichmentFields(extraFields: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(extraFields).filter(([key]) => ENRICHMENT_KEYS.has(key)))
}
