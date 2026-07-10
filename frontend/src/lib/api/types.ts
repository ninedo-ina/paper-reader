// =============================================================================
// API 类型定义 — 镜像后端 DTO 结构
// =============================================================================

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
  accessToken: string
  refreshToken: string
  expiresIn: number // 毫秒
  isNewUser: boolean // 首次登录（新创建用户）时为 true
}

export interface LoginRequest {
  email: string
  password: string
}

export interface SendCodeRequest {
  email: string
}

export interface EmailLoginRequest {
  email: string
  code: string
}

export interface GitHubAuthRequest {
  code: string
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

// --- 论文 ---

export type SourceType = "UPLOAD" | "URL" | "MANUAL"

export interface PaperListDto {
  id: number
  title: string
  authors?: string
  doi?: string
  year?: number
  journal?: string
  sourceType: SourceType
  pageCount?: number
  createdAt: string
}

export interface PaperDetailDto {
  id: number
  title: string
  authors?: string
  abstractText?: string
  participants?: string
  doi?: string
  year?: number
  journal?: string
  sourceType: SourceType
  sourceUrl?: string
  pageCount?: number
  fileSize?: number
  grobidResult?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface UploadFromUrlRequest {
  url: string
  title?: string
}

export interface CreatePaperRequest {
  title: string
  authors?: string
  participants?: string
  abstractText?: string
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
}

export interface UpdateAnnotationRequest {
  type?: AnnotationType
  color?: string
  position?: Record<string, unknown>
  text?: string
  comment?: string
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
}

export interface UpdateNoteRequest {
  title?: string
  content?: string
  pageNumber?: number
  chapter?: string
  tags?: string[]
}

// --- 阅读记录 ---

export interface ReadingLogDto {
  id: number
  paperId: number
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
  language: "zh" | "en"
  defaultAiModel?: string
}

export interface UpdateUserSettingsRequest {
  theme?: "light" | "dark"
  language?: "zh" | "en"
  defaultAiModel?: string
}
