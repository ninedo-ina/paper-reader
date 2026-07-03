// =============================================================================
// 论文 API — 上传、列表、详情、下载、删除
// =============================================================================

import { get, post, postForm, del } from "./client"
import type { PaperListDto, PaperDetailDto, PageResponse, UploadFromUrlRequest } from "./types"

/** 获取用户论文列表（分页） */
export function listPapers(page = 1, pageSize = 20): Promise<PageResponse<PaperListDto>> {
  return get<PageResponse<PaperListDto>>(`/papers?page=${page}&pageSize=${pageSize}`)
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
  return post<PaperDetailDto>("/papers/upload-url", data)
}

/** 下载论文 PDF */
export function getDownloadUrl(id: number): string {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api"
  return `${base}/papers/${id}/download`
}

/** 删除论文 */
export function deletePaper(id: number): Promise<null> {
  return del<null>(`/papers/${id}`)
}
