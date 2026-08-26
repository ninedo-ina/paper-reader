// =============================================================================
// 论文 API — 上传、列表、详情、下载、删除、编辑、收藏、标签、分享
// =============================================================================

import { get, post, postForm, put, patch, del, downloadBlob } from "./client"
import type {
  PaperListDto,
  PaperDetailDto,
  PageResponse,
  UploadFromUrlRequest,
  CreatePaperRequest,
  UpdatePaperRequest,
  PaperTagDto,
  SharePaperResponse,
  PaperContextDto,
  PaperContextRequest,
  MetadataResolutionDto,
  MetadataApplyResponse,
  MetadataSourceDto,
} from "./types"

/** 获取用户论文列表（分页，可选 sourceType/favorite 过滤） */
export function listPapers(
  page = 0,
  pageSize = 20,
  sourceType?: string,
  favorite?: boolean,
): Promise<PageResponse<PaperListDto>> {
  let url = `/papers?page=${page}&pageSize=${pageSize}`
  if (sourceType) url += `&sourceType=${sourceType}`
  if (favorite !== undefined) url += `&favorite=${favorite}`
  return get<PageResponse<PaperListDto>>(url)
}

/** 获取收藏论文总数 */
export function countFavorites(): Promise<PageResponse<PaperListDto>> {
  return listPapers(0, 1, undefined, true)
}

/** 获取论文详情 */
export function getPaper(id: number): Promise<PaperDetailDto> {
  return get<PaperDetailDto>(`/papers/${id}`)
}

/** 上传 PDF 文件 */
export function uploadPdf(file: File): Promise<PaperDetailDto> {
  const fd = new FormData()
  fd.append("file", file)
  return postForm<PaperDetailDto>("/papers/upload", fd)
}

/** 从 URL 导入论文 */
export function uploadFromUrl(data: UploadFromUrlRequest): Promise<PaperDetailDto> {
  return post<PaperDetailDto>("/papers/url", data)
}

/** 获取论文选区问答所需的有限上下文 */
export function getPaperContext(id: number, data: PaperContextRequest): Promise<PaperContextDto> {
  return post<PaperContextDto>(`/papers/${id}/context`, data)
}

/** 手动创建论文 */
export function createPaper(data: CreatePaperRequest): Promise<PaperDetailDto> {
  return post<PaperDetailDto>("/papers", data)
}

/** 更新论文元数据 */
export function updatePaper(id: number, data: UpdatePaperRequest): Promise<PaperDetailDto> {
  return patch<PaperDetailDto>(`/papers/${id}`, data)
}

/** Resolve exact arXiv/DOI metadata into an expiring preview. */
export function resolvePaperMetadata(id: number, identifier?: string): Promise<MetadataResolutionDto> {
  return post<MetadataResolutionDto>(`/papers/${id}/metadata/resolve`, identifier?.trim() ? { identifier: identifier.trim() } : {})
}

/** Re-read a previously generated metadata preview. */
export function getMetadataResolution(id: number, resolutionId: number): Promise<MetadataResolutionDto> {
  return get<MetadataResolutionDto>(`/papers/${id}/metadata/resolutions/${resolutionId}`)
}

/** Apply only the fields selected in the preview. */
export function applyPaperMetadata(id: number, resolutionId: number, fields?: string[]): Promise<MetadataApplyResponse> {
  return post<MetadataApplyResponse>(`/papers/${id}/metadata/resolutions/${resolutionId}/apply`, fields ? { fields } : {})
}

/** List immutable provider snapshots captured for this paper. */
export function listPaperMetadataSources(id: number): Promise<MetadataSourceDto[]> {
  return get<MetadataSourceDto[]>(`/papers/${id}/metadata/sources`)
}

/** 切换收藏 */
export function toggleFavorite(id: number, favorite: boolean): Promise<PaperDetailDto> {
  return put<PaperDetailDto>(`/papers/${id}/favorite`, { favorite })
}

/** 获取论文标签列表 */
export function listPaperTags(id: number): Promise<PaperTagDto[]> {
  return get<PaperTagDto[]>(`/papers/${id}/tags`)
}

/** 添加标签 */
export function addPaperTag(id: number, tag: string): Promise<PaperTagDto> {
  return post<PaperTagDto>(`/papers/${id}/tags`, { tag })
}

/** 删除标签 */
export function removePaperTag(id: number, tag: string): Promise<null> {
  return del<null>(`/papers/${id}/tags/${encodeURIComponent(tag)}`)
}

/** 生成分享文案 */
export function sharePaper(id: number, description?: string): Promise<SharePaperResponse> {
  return post<SharePaperResponse>(`/papers/${id}/share`, { description })
}

/** 下载论文 PDF */
export function getDownloadUrl(id: number): string {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api"
  return `${base}/papers/${id}/download`
}

/** 带 JWT 认证下载 PDF 并触发浏览器保存 */
export async function downloadPdf(id: number, filename = "paper.pdf"): Promise<void> {
  const blob = await downloadBlob(`/papers/${id}/download`)
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** 删除论文，可选择是否同时物理删除服务器中的原文件 */
export function deletePaper(id: number, deleteFile = false): Promise<null> {
  return del<null>(`/papers/${id}?deleteFile=${deleteFile}`)
}
