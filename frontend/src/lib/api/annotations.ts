// =============================================================================
// 批注 API — 增删改查
// =============================================================================

import { get, post, put, del } from "./client"
import type {
  AnnotationDto,
  CreateAnnotationRequest,
  UpdateAnnotationRequest,
  PageResponse,
} from "./types"

/** 获取论文的所有批注 */
export function listAnnotations(
  paperId: number,
  page = 0,
  pageSize = 100,
): Promise<PageResponse<AnnotationDto>> {
  return get<PageResponse<AnnotationDto>>(
    `/annotations/${paperId}?page=${page}&pageSize=${pageSize}`,
  )
}

/** 创建批注 */
export function createAnnotation(data: CreateAnnotationRequest): Promise<AnnotationDto> {
  return post<AnnotationDto>("/annotations", data)
}

/** 更新批注 */
export function updateAnnotation(
  id: number,
  data: UpdateAnnotationRequest,
): Promise<AnnotationDto> {
  return put<AnnotationDto>(`/annotations/${id}`, data)
}

/** 删除批注 */
export function deleteAnnotation(id: number): Promise<null> {
  return del<null>(`/annotations/${id}`)
}
