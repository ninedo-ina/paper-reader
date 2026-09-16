import type { Category } from "@/lib/api/types"

export interface CategoryOption {
  /** Translation key inside the `categories` namespace. */
  labelKey: string
  value: string
}

export interface CategoryField {
  key: string
  /** Translation key inside the `categories` namespace. */
  labelKey: string
  type: "text" | "select" | "date" | "textarea"
  required?: boolean
  options?: CategoryOption[]
  /** Translation key inside the `categories` namespace. */
  placeholderKey?: string
}

export interface CategoryDef {
  value: Category
  /** Translation key inside the `categories` namespace. */
  labelKey: string
  fields: CategoryField[]
}

export const CATEGORIES: CategoryDef[] = [
  {
    value: "THESIS",
    labelKey: "thesis.label",
    fields: [
      { key: "degreeType", labelKey: "thesis.fields.degreeType.label", type: "select", required: true, options: [
        { labelKey: "thesis.fields.degreeType.options.doctor", value: "doctor" },
        { labelKey: "thesis.fields.degreeType.options.master", value: "master" },
        { labelKey: "thesis.fields.degreeType.options.bachelor", value: "bachelor" },
      ]},
      { key: "advisor", labelKey: "thesis.fields.advisor.label", type: "text", required: true },
      { key: "university", labelKey: "thesis.fields.university.label", type: "text", required: true },
      { key: "major", labelKey: "thesis.fields.major.label", type: "text" },
    ],
  },
  {
    value: "JOURNAL",
    labelKey: "journal.label",
    fields: [
      { key: "journalName", labelKey: "journal.fields.journalName.label", type: "text", required: true },
      { key: "volume", labelKey: "journal.fields.volume.label", type: "text" },
      { key: "issue", labelKey: "journal.fields.issue.label", type: "text" },
      { key: "pages", labelKey: "journal.fields.pages.label", type: "text" },
      { key: "issnIsbn", labelKey: "journal.fields.issnIsbn.label", type: "text" },
      { key: "indexing", labelKey: "journal.fields.indexing.label", type: "select", options: [
        { labelKey: "journal.fields.indexing.options.SCI", value: "SCI" },
        { labelKey: "journal.fields.indexing.options.EI", value: "EI" },
        { labelKey: "journal.fields.indexing.options.SSCI", value: "SSCI" },
        { labelKey: "journal.fields.indexing.options.PKU_CORE", value: "PKU_CORE" },
        { labelKey: "journal.fields.indexing.options.CSSCI", value: "CSSCI" },
        { labelKey: "journal.fields.indexing.options.OTHER", value: "OTHER" },
      ]},
    ],
  },
  {
    value: "PREPRINT",
    labelKey: "preprint.label",
    fields: [
      { key: "platform", labelKey: "preprint.fields.platform.label", type: "select", required: true, options: [
        { labelKey: "preprint.fields.platform.options.arxiv", value: "arxiv" },
        { labelKey: "preprint.fields.platform.options.biorxiv", value: "biorxiv" },
        { labelKey: "preprint.fields.platform.options.ssrn", value: "ssrn" },
        { labelKey: "preprint.fields.platform.options.researchgate", value: "researchgate" },
        { labelKey: "preprint.fields.platform.options.other", value: "other" },
      ]},
      { key: "versionNumber", labelKey: "preprint.fields.versionNumber.label", type: "text" },
      { key: "doiStatus", labelKey: "preprint.fields.doiStatus.label", type: "select", options: [
        { labelKey: "preprint.fields.doiStatus.options.has_doi", value: "has_doi" },
        { labelKey: "preprint.fields.doiStatus.options.no_doi", value: "no_doi" },
      ]},
    ],
  },
  {
    value: "COURSE",
    labelKey: "course.label",
    fields: [
      { key: "courseName", labelKey: "course.fields.courseName.label", type: "text", required: true },
      { key: "instructor", labelKey: "course.fields.instructor.label", type: "text" },
      { key: "university", labelKey: "course.fields.university.label", type: "text" },
      { key: "semester", labelKey: "course.fields.semester.label", type: "text", placeholderKey: "course.fields.semester.placeholder" },
    ],
  },
  {
    value: "TECH_REPORT",
    labelKey: "tech_report.label",
    fields: [
      { key: "institution", labelKey: "tech_report.fields.institution.label", type: "text", required: true },
      { key: "reportNumber", labelKey: "tech_report.fields.reportNumber.label", type: "text" },
      { key: "projectName", labelKey: "tech_report.fields.projectName.label", type: "text" },
    ],
  },
  {
    value: "PATENT",
    labelKey: "patent.label",
    fields: [
      { key: "patentNumber", labelKey: "patent.fields.patentNumber.label", type: "text", required: true },
      { key: "patentType", labelKey: "patent.fields.patentType.label", type: "select", required: true, options: [
        { labelKey: "patent.fields.patentType.options.invention", value: "invention" },
        { labelKey: "patent.fields.patentType.options.utility_model", value: "utility_model" },
        { labelKey: "patent.fields.patentType.options.design", value: "design" },
      ]},
      { key: "applicationDate", labelKey: "patent.fields.applicationDate.label", type: "date" },
      { key: "grantDate", labelKey: "patent.fields.grantDate.label", type: "date" },
      { key: "patentHolder", labelKey: "patent.fields.patentHolder.label", type: "text" },
    ],
  },
]

export function getCategory(cat: Category): CategoryDef {
  return CATEGORIES.find((c) => c.value === cat) ?? CATEGORIES[1] // default to JOURNAL
}
