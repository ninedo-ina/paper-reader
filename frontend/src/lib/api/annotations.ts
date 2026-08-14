// =============================================================================
// 批注 API — 增删改查
// =============================================================================

import { get, post, put, del } from "./client"
import type {
  AnnotationDto,
  AnnotationCommentDto,
  CreateAnnotationRequest,
  CreateAnnotationCommentRequest,
  UpdateAnnotationRequest,
  PageResponse,
} from "./types"

/** 获取所有论文的批注 */
export function listAllAnnotations(
  page = 0,
  pageSize = 20,
): Promise<PageResponse<AnnotationDto>> {
  return get<PageResponse<AnnotationDto>>(
    `/annotations?page=${page}&pageSize=${pageSize}`,
  )
}

/** 获取论文的所有批注 */
export function listAnnotations(
  paperId: number,
  page = 0,
  pageSize = 100,
): Promise<PageResponse<AnnotationDto>> {
  return get<PageResponse<AnnotationDto>>(
    `/annotations/paper/${paperId}?page=${page}&pageSize=${pageSize}`,
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

// ==== 批注评论 ====

/** 添加评论 */
export function addComment(
  annotationId: number,
  data: CreateAnnotationCommentRequest,
): Promise<AnnotationCommentDto> {
  return post<AnnotationCommentDto>(`/annotations/${annotationId}/comments`, data)
}

/** 获取批注的评论列表 */
export function listComments(annotationId: number): Promise<AnnotationCommentDto[]> {
  return get<AnnotationCommentDto[]>(`/annotations/${annotationId}/comments`)
}

/** 删除评论 */
export function deleteComment(commentId: number): Promise<null> {
  return del<null>(`/annotations/comments/${commentId}`)
}
