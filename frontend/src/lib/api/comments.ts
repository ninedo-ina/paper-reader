// =============================================================================
// 正文批注 API（W7）— 可读者都能评论；改正文限作者，标记解决限作者/EDITOR
// =============================================================================

import { get, post, patch, del } from "./client"
import type {
  CreateCommentRequest,
  PaperCommentDto,
  UpdateCommentRequest,
} from "./types"

export function listComments(paperId: number): Promise<PaperCommentDto[]> {
  return get<PaperCommentDto[]>(`/papers/${paperId}/comments`)
}

export function createComment(
  paperId: number,
  data: CreateCommentRequest,
): Promise<PaperCommentDto> {
  return post<PaperCommentDto>(`/papers/${paperId}/comments`, data)
}

export function updateComment(
  paperId: number,
  commentId: number,
  data: UpdateCommentRequest,
): Promise<PaperCommentDto> {
  return patch<PaperCommentDto>(`/papers/${paperId}/comments/${commentId}`, data)
}

export function deleteComment(paperId: number, commentId: number): Promise<null> {
  return del<null>(`/papers/${paperId}/comments/${commentId}`)
}
