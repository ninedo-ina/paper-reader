import type { Category } from "@/lib/api/types"

export interface CategoryField {
  key: string
  label: string
  labelEn: string
  type: "text" | "select" | "date" | "textarea"
  required?: boolean
  options?: { label: string; value: string }[]
  placeholder?: string
}

export interface CategoryDef {
  value: Category
  label: string
  labelEn: string
  fields: CategoryField[]
}

export const CATEGORIES: CategoryDef[] = [
  {
    value: "THESIS",
    label: "学位论文",
    labelEn: "Thesis / Dissertation",
    fields: [
      { key: "degreeType", label: "学位类型", labelEn: "Degree Type", type: "select", required: true, options: [
        { label: "博士", value: "doctor" },
        { label: "硕士", value: "master" },
        { label: "学士", value: "bachelor" },
      ]},
      { key: "advisor", label: "导师", labelEn: "Advisor", type: "text", required: true },
      { key: "university", label: "学校/机构", labelEn: "University", type: "text", required: true },
      { key: "major", label: "专业", labelEn: "Major", type: "text" },
    ],
  },
  {
    value: "JOURNAL",
    label: "期刊会议论文",
    labelEn: "Journal / Conference",
    fields: [
      { key: "journalName", label: "期刊/会议名称", labelEn: "Journal / Conference Name", type: "text", required: true },
      { key: "volume", label: "卷号", labelEn: "Volume", type: "text" },
      { key: "issue", label: "期号", labelEn: "Issue", type: "text" },
      { key: "pages", label: "页码", labelEn: "Pages", type: "text" },
      { key: "issnIsbn", label: "ISSN/ISBN", labelEn: "ISSN/ISBN", type: "text" },
      { key: "indexing", label: "收录情况", labelEn: "Indexing", type: "select", options: [
        { label: "SCI", value: "SCI" },
        { label: "EI", value: "EI" },
        { label: "SSCI", value: "SSCI" },
        { label: "北大核心", value: "PKU_CORE" },
        { label: "CSSCI", value: "CSSCI" },
        { label: "其他", value: "OTHER" },
      ]},
    ],
  },
  {
    value: "PREPRINT",
    label: "预印本",
    labelEn: "Preprint",
    fields: [
      { key: "platform", label: "预印本平台", labelEn: "Platform", type: "select", required: true, options: [
        { label: "arXiv", value: "arxiv" },
        { label: "bioRxiv", value: "biorxiv" },
        { label: "SSRN", value: "ssrn" },
        { label: "ResearchGate", value: "researchgate" },
        { label: "其他", value: "other" },
      ]},
      { key: "versionNumber", label: "版本号", labelEn: "Version Number", type: "text" },
      { key: "doiStatus", label: "DOI 状态", labelEn: "DOI Status", type: "select", options: [
        { label: "有 DOI", value: "has_doi" },
        { label: "暂无 DOI", value: "no_doi" },
      ]},
    ],
  },
  {
    value: "COURSE",
    label: "课程论文",
    labelEn: "Course Paper",
    fields: [
      { key: "courseName", label: "课程名称", labelEn: "Course Name", type: "text", required: true },
      { key: "instructor", label: "授课教师", labelEn: "Instructor", type: "text" },
      { key: "university", label: "学校", labelEn: "University", type: "text" },
      { key: "semester", label: "学期", labelEn: "Semester", type: "text", placeholder: "例: 2024-2025 秋季学期" },
    ],
  },
  {
    value: "TECH_REPORT",
    label: "研究报告",
    labelEn: "Technical Report",
    fields: [
      { key: "institution", label: "研究机构", labelEn: "Institution", type: "text", required: true },
      { key: "reportNumber", label: "报告编号", labelEn: "Report Number", type: "text" },
      { key: "projectName", label: "项目名称", labelEn: "Project Name", type: "text" },
    ],
  },
  {
    value: "PATENT",
    label: "专利文献",
    labelEn: "Patent",
    fields: [
      { key: "patentNumber", label: "专利号", labelEn: "Patent Number", type: "text", required: true },
      { key: "patentType", label: "专利类型", labelEn: "Patent Type", type: "select", required: true, options: [
        { label: "发明专利", value: "invention" },
        { label: "实用新型", value: "utility_model" },
        { label: "外观设计", value: "design" },
      ]},
      { key: "applicationDate", label: "申请日期", labelEn: "Application Date", type: "date" },
      { key: "grantDate", label: "授权日期", labelEn: "Grant Date", type: "date" },
      { key: "patentHolder", label: "专利权人", labelEn: "Patent Holder", type: "text" },
    ],
  },
]

export function getCategory(cat: Category): CategoryDef {
  return CATEGORIES.find((c) => c.value === cat) ?? CATEGORIES[1] // default to JOURNAL
}
