import { get, post } from "./client"
import type { PaperVersionDto, CreateVersionRequest } from "./types"

/** 创建版本（发布） */
export function createVersion(paperId: number, data: CreateVersionRequest): Promise<PaperVersionDto> {
  return post<PaperVersionDto>(`/papers/${paperId}/versions`, data)
}

/** 列出论文所有版本 */
export function listVersions(paperId: number): Promise<PaperVersionDto[]> {
  return get<PaperVersionDto[]>(`/papers/${paperId}/versions`)
}
