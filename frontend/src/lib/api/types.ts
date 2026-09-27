// =============================================================================
// API 类型定义 — 镜像后端 DTO 结构
// =============================================================================

import type { AppLocale } from "@/i18n/locales"
import type { JSONContent } from "@tiptap/react"

// --- 通用响应封装 ---

export interface ApiResponse<T> {
  code: number // 0=成功, 1001=Token过期, 1002=权限不足, 1003=参数错误, 1004=资源不存在
  message: string
  data: T | null
}

export interface PageResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

// --- 认证 ---

export interface TokenResponse {
  // 需要二次验证时 accessToken / refreshToken 为空，改由 challengeToken 走验证接口
  accessToken: string | null
  refreshToken: string | null
  expiresIn: number // 毫秒
  isNewUser: boolean // 首次登录（新创建用户）时为 true
  twoFactorRequired?: boolean
  challengeToken?: string | null
}

export interface LoginRequest {
  email: string
  password: string
  deviceId?: string
  deviceName?: string
}

export interface SendCodeRequest {
  email: string
}

export interface EmailLoginRequest {
  email: string
  code: string
  deviceId?: string
  deviceName?: string
}

export interface GitHubAuthRequest {
  code: string
  deviceId?: string
  deviceName?: string
}

// --- 两步验证 / 信任设备 ---

export interface TwoFactorStatus {
  enabled: boolean
  recoveryCodesRemaining: number
  recoveryCodesTotal: number
}

export interface TwoFactorSetup {
  secret: string
  otpauthUri: string
  digits: number
  period: number
}

export interface TwoFactorEnableRequest {
  password: string
  code: string
}

export interface TwoFactorDisableRequest {
  password: string
  code: string
}

export interface RecoveryCodeRegenerateRequest {
  password: string
}

export interface TwoFactorEnableResponse {
  /** 9 个 6 位恢复码，仅在开启/重置的那一刻返回一次 */
  recoveryCodes: string[]
}

export interface TwoFactorVerifyRequest {
  challengeToken: string
  code: string
  trustDevice?: boolean
  deviceId?: string
  deviceName?: string
}

export interface TrustedDevice {
  id: number
  deviceKey: string
  deviceName: string
  userAgent: string | null
  ipAddress: string | null
  trusted: boolean
  trustedUntil: string | null
  lastLoginAt: string
  current: boolean
}

export interface RefreshTokenRequest {
  refreshToken: string
}

export interface UserProfile {
  id: number
  email: string
  displayName: string | null
  avatarUrl: string | null
  authProvider: string
}

export interface UpdateProfileRequest {
  displayName?: string
  avatarUrl?: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

// --- 论文 ---

export type SourceType = "UPLOAD" | "URL" | "MANUAL"
export type Category = "THESIS" | "JOURNAL" | "PREPRINT" | "COURSE" | "TECH_REPORT" | "PATENT"
export type StorageType = "GITHUB" | "GITEE" | "OSS" | "S3"

export interface PaperListDto {
  id: number
  title: string
  authors?: string
  doi?: string
  year?: string
  journal?: string
  category: Category
  sourceType: SourceType
  hasOriginalFile: boolean
  pageCount?: number
  favorite: boolean
  tags?: string[]
  createdAt: string
}

export interface PaperDetailDto {
  id: number
  title: string
  authors?: string
  abstractText?: string
  participants?: string
  doi?: string
  year?: string
  journal?: string
  category: Category
  extraFields?: Record<string, unknown>
  storageConfigId?: number
  favorite: boolean
  sourceType: SourceType
  sourceUrl?: string
  hasOriginalFile: boolean
  pageCount?: number
  fileSize?: number
  parseStatus?: "NOT_APPLICABLE" | "PENDING" | "PROCESSING" | "READY" | "FAILED" | string
  parseError?: string
  /** @deprecated Raw GROBID data is no longer used by the Reader UI. */
  grobidResult?: Record<string, unknown>
  tags?: string[]
  createdAt: string
  updatedAt: string
}

// --- External metadata enrichment ---

export interface MetadataFieldCandidateDto {
  field: string
  currentValue?: string | null
  suggestedValue?: string | null
  source?: string | null
  recordUrl?: string | null
  matchMethod?: string
  confidence: number
  conflict: boolean
  selectedByDefault: boolean
}

export interface MetadataManifestationDto {
  type: string
  label: string
  fields: MetadataFieldCandidateDto[]
}

export interface MetadataSourceDto {
  id: number
  provider: string
  externalId?: string | null
  recordUrl?: string | null
  matchMethod: string
  confidence: number
  status: string
  errorCode?: string | null
  fetchedAt: string
}

export interface MetadataResolutionDto {
  id: number
  paperId: number
  expectedUpdatedAt: string
  expiresAt: string
  createdAt: string
  identifiers: Record<string, string>
  fields: MetadataFieldCandidateDto[]
  manifestations?: MetadataManifestationDto[]
  sources?: MetadataSourceDto[]
  warnings?: string[]
}

export interface MetadataApplyResponse {
  paper: PaperDetailDto
  appliedFields: string[]
}

export interface PaperContextChunkDto {
  id: number
  sectionTitle?: string
  ordinal: number
  content: string
  pageStart?: number
  pageEnd?: number
}

export interface PaperContextDto {
  paperId: number
  title: string
  authors?: string
  abstractText?: string
  parseStatus: "NOT_APPLICABLE" | "PENDING" | "PROCESSING" | "READY" | "FAILED" | string
  parseError?: string
  selectedText: string
  pageNumber?: number
  chunks: PaperContextChunkDto[]
}

export interface PaperContextRequest {
  selectedText: string
  pageNumber?: number
}

export interface UploadFromUrlRequest {
  url: string
  title?: string
}

/** 上传配额：限额和已用量（字节）都由服务端给，前端只负责显示 */
export interface UploadQuotaDto {
  fileLimitBytes: number
  dailyLimitBytes: number
  totalLimitBytes: number
  dailyUsedBytes: number
  totalUsedBytes: number
  dailyRemainingBytes: number
  totalRemainingBytes: number
}

export interface CreatePaperRequest {
  title: string
  authors?: string
  participants?: string
  abstractText?: string
  category?: Category
  extraFields?: Record<string, unknown>
  storageConfigId?: number
}

// --- 论文版本 ---

export interface CreateVersionRequest {
  version: string
  remark?: string
}

export interface PaperVersionDto {
  id: number
  paperId: number
  version: string
  remark?: string
  storagePushStatus: string
  createdAt: string
}

// --- 导入 / 导出（W5）---

/** 单一导出格式及其在当前服务端是否可用（引擎缺失时 available=false）。 */
export interface ExportFormatDto {
  /** markdown / html / latex / bibtex / docx / pdf */
  id: string
  /** 文件扩展名，如 md / tex / bib / docx / pdf */
  ext: string
  available: boolean
}

export interface ExportCapabilitiesDto {
  formats: ExportFormatDto[]
  importAvailable: boolean
}

export interface CreateExportRequest {
  format: string
  /** 关联的发布版本；省略表示导出当前草稿正文。 */
  versionId?: number | null
}

/** 一次导出的产物记录，回挂在 pr_paper_versions 上，可二次下载。 */
export interface ExportArtifactDto {
  id: number
  paperId: number
  versionId: number | null
  format: string
  engine: string | null
  byteSize: number | null
  contentVersion: number | null
  status: string
  /** 二次下载地址（含 /api 前缀，前端下载时改用相对 API 的路径）。 */
  downloadUrl: string
  createdAt: string
}

export interface ImportMarkdownRequest {
  markdown: string
}

export interface ImportResultDto {
  /** 转换后的正文 HTML 片段，供编辑器 setContent 预览、由用户确认保存。 */
  contentHtml: string
}

// --- 存储配置 ---

export interface StorageConfigDto {
  id: number
  name: string
  storageType: StorageType
  config: Record<string, unknown>
  isDefault: boolean
  createdAt: string
}

export interface CreateStorageConfigRequest {
  name: string
  storageType: StorageType
  config: Record<string, unknown>
  isDefault?: boolean
}

export interface UpdateStorageConfigRequest {
  name?: string
  config?: Record<string, unknown>
  isDefault?: boolean
}

// --- 批注 ---

export type AnnotationType = "HIGHLIGHT" | "UNDERLINE" | "STRIKETHROUGH" | "NOTE" | "AREA"

export interface AnnotationDto {
  id: number
  paperId: number
  pageNumber: number
  type: AnnotationType
  color?: string
  position: Record<string, unknown>
  text?: string
  comment?: string
  quotedText?: string
  startOffset?: number
  endOffset?: number
  images?: string[]
  commentCount?: number
  createdAt: string
  updatedAt: string
}

export interface CreateAnnotationRequest {
  paperId: number
  pageNumber: number
  type: AnnotationType
  color?: string
  position: Record<string, unknown>
  text?: string
  comment?: string
  quotedText?: string
  startOffset?: number
  endOffset?: number
  images?: string[]
}

export interface UpdateAnnotationRequest {
  type?: AnnotationType
  color?: string
  position?: Record<string, unknown>
  text?: string
  comment?: string
  quotedText?: string
  startOffset?: number
  endOffset?: number
  images?: string[]
}

// --- 批注评论 ---

export interface AnnotationCommentDto {
  id: number
  annotationId: number
  userId: number
  content: string
  parentId?: number
  createdAt: string
}

export interface CreateAnnotationCommentRequest {
  content: string
  parentId?: number
}

// --- 笔记 ---

export interface NoteDto {
  id: number
  paperId: number
  title?: string
  content: string
  pageNumber?: number
  chapter?: string
  tags?: string[]
  quotedText?: string
  startOffset?: number
  endOffset?: number
  images?: string[]
  position?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface CreateNoteRequest {
  paperId: number
  title?: string
  content: string
  pageNumber?: number
  chapter?: string
  tags?: string[]
  quotedText?: string
  startOffset?: number
  endOffset?: number
  images?: string[]
  position?: Record<string, unknown>
}

export interface UpdateNoteRequest {
  title?: string
  content?: string
  pageNumber?: number
  chapter?: string
  tags?: string[]
  quotedText?: string
  startOffset?: number
  endOffset?: number
  images?: string[]
  position?: Record<string, unknown>
}

// --- 阅读记录 ---

export interface ReadingLogDto {
  id: number
  paperId: number
  paperTitle?: string
  currentPage: number
  totalPages: number
  durationSeconds?: number
  createdAt: string
}

export interface CreateReadingLogRequest {
  paperId: number
  currentPage: number
  totalPages: number
  durationSeconds?: number
}

// --- AI 对话 ---

export interface AiChatListDto {
  id: number
  paperId?: number
  model: string
  title: string
  createdAt: string
}

export interface AiMessageDto {
  id: number
  role: "user" | "assistant" | "system"
  content: string
  createdAt: string
}

export interface AiChatDetailDto {
  id: number
  paperId?: number
  model: string
  title: string
  messages: AiMessageDto[]
  createdAt: string
}

export interface CreateChatRequest {
  paperId?: number
  model: string
  title: string
  message?: string
}

export interface ChatRequest {
  message: string
}

// --- 用户设置 ---

export interface UserSettingsDto {
  theme: "light" | "dark"
  /** 与 src/i18n/locales.ts 的 AppLocale 保持一致（后端按字符串存储，列宽 10） */
  language: AppLocale
  defaultAiModel?: string
}

export interface UpdateUserSettingsRequest {
  theme?: "light" | "dark"
  language?: AppLocale
  defaultAiModel?: string
}

// --- Paper Edit ---

export interface UpdatePaperRequest {
  title?: string
  authors?: string
  participants?: string
  abstractText?: string
  category?: Category
  extraFields?: Record<string, unknown>
  doi?: string
  year?: string
  journal?: string
}

// --- Paper Content（正文，与 abstractText 摘要彻底分离）---

export interface PaperContentDto {
  paperId: number
  /** 权威内容：编辑器节点树，可无损还原 */
  contentJson: JSONContent | null
  /** 派生内容：由 contentJson 渲染，便于预览/导出，可随时重建 */
  contentHtml: string | null
  /** 每次保存自增，供前端判断自己写的是第几版 */
  contentVersion: number
  updatedAt: string
}

export interface UpdatePaperContentRequest {
  contentJson: JSONContent
  contentHtml?: string
  /** 本次保存所基于的正文版本号；服务端据此拒绝陈旧的后写覆盖（返回 409），null 则不校验 */
  baseVersion?: number
}

// --- 正文快照（W6，REQ-202609-0262）---
// 注意与上面的 PaperVersionDto 区分：那个是「发布记录 / storage push 状态」，
// 本组是「正文在某时刻长什么样」，两张表、两条接口。

/** 快照来源：用户手动创建 / 回滚前自动留下的当前态。 */
export type ContentSnapshotSource = "MANUAL" | "ROLLBACK"

export interface ContentSnapshotSummaryDto {
  id: number
  paperId: number
  /** 手动标签（「初稿」「投稿版」）；null = 未打标签 */
  label: string | null
  source: ContentSnapshotSource
  /** 快照时刻的正文版本号，可与 Timeline 上的保存记录对齐 */
  contentVersion: number
  createdAt: string
}

/** 取单条时才带正文；列表接口不带，避免把整篇正文都传一遍。 */
export interface ContentSnapshotDetailDto extends ContentSnapshotSummaryDto {
  contentJson: JSONContent | null
  contentHtml: string | null
}

export interface CreateContentSnapshotRequest {
  label?: string | null
}

export interface RenameContentSnapshotRequest {
  label?: string | null
}

export interface RestoreContentSnapshotRequest {
  /** 同 UpdatePaperContentRequest.baseVersion：落后于服务端当前版本时拒绝回滚（409/1008） */
  baseVersion?: number
}

export interface PaperTagDto {
  id: number
  paperId: number
  tag: string
  createdAt: string
}

export interface SharePaperResponse {
  shareText: string
}
