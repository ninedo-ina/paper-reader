// =============================================================================
// 协作者管理 API（W7）— 作者增删协作者；「与我协作」列表
// =============================================================================

import { get, post, del } from "./client"
import type {
  AddCollaboratorRequest,
  CollaboratorDto,
  SharedPaperDto,
} from "./types"

/** 论文的协作者列表；任何可读者都能看。 */
export function listCollaborators(paperId: number): Promise<CollaboratorDto[]> {
  return get<CollaboratorDto[]>(`/papers/${paperId}/collaborators`)
}

/** 按邮箱添加协作者（仅作者）。role 缺省 EDITOR。 */
export function addCollaborator(
  paperId: number,
  data: AddCollaboratorRequest,
): Promise<CollaboratorDto> {
  return post<CollaboratorDto>(`/papers/${paperId}/collaborators`, data)
}

/** 移除协作者（仅作者）。 */
export function removeCollaborator(paperId: number, userId: number): Promise<null> {
  return del<null>(`/papers/${paperId}/collaborators/${userId}`)
}

/** 与我协作：我作为协作者被授权的论文。 */
export function listSharedWithMe(): Promise<SharedPaperDto[]> {
  return get<SharedPaperDto[]>(`/papers/shared-with-me`)
}
