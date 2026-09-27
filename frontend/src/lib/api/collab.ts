// =============================================================================
// 协作正文 API（W7）— CRDT 快照的读取 / 首次播种 / 保存
// =============================================================================

import { get, post, put } from "./client"
import type {
  CollabStateDto,
  SaveCollabStateRequest,
  SeedCollabStateRequest,
} from "./types"

/** 读取协作正文快照；任何可读者（作者 / 协作者）都能取。 */
export function getCollabState(paperId: number): Promise<CollabStateDto> {
  return get<CollabStateDto>(`/papers/${paperId}/collab/state`)
}

/** 首次播种（insert-if-absent）：并发时服务端只认第一份，返回最终生效的快照。 */
export function seedCollabState(
  paperId: number,
  data: SeedCollabStateRequest,
): Promise<CollabStateDto> {
  return post<CollabStateDto>(`/papers/${paperId}/collab/state`, data)
}

/** 保存快照（后写覆盖 LWW），同时把 contentJson/Html 镜像回正文主表。 */
export function saveCollabState(
  paperId: number,
  data: SaveCollabStateRequest,
): Promise<CollabStateDto> {
  return put<CollabStateDto>(`/papers/${paperId}/collab/state`, data)
}
