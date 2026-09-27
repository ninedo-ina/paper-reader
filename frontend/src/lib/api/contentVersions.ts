import { get, patch, post } from "./client"
import type {
  ContentSnapshotDetailDto,
  ContentSnapshotSummaryDto,
  CreateContentSnapshotRequest,
  PaperContentDto,
  RenameContentSnapshotRequest,
  RestoreContentSnapshotRequest,
} from "./types"

/**
 * 正文快照（W6）。走 `/papers/{id}/content-versions`，与「发布记录」的 `/versions` 分开：
 * 前者是正文历史，后者是推送到外部存储平台的记录，语义不同、不要混用。
 */

/** 手动打一条快照，可带标签（「初稿」「投稿版」） */
export function createContentSnapshot(
  paperId: number,
  data: CreateContentSnapshotRequest = {},
): Promise<ContentSnapshotSummaryDto> {
  return post<ContentSnapshotSummaryDto>(`/papers/${paperId}/content-versions`, data)
}

/** 时间线：新的在前，只回元信息 */
export function listContentSnapshots(paperId: number): Promise<ContentSnapshotSummaryDto[]> {
  return get<ContentSnapshotSummaryDto[]>(`/papers/${paperId}/content-versions`)
}

/** 取单条快照（带正文），用于预览与对比 */
export function getContentSnapshot(paperId: number, snapshotId: number): Promise<ContentSnapshotDetailDto> {
  return get<ContentSnapshotDetailDto>(`/papers/${paperId}/content-versions/${snapshotId}`)
}

/** 改标签；传 null 即清空标签 */
export function renameContentSnapshot(
  paperId: number,
  snapshotId: number,
  data: RenameContentSnapshotRequest,
): Promise<ContentSnapshotSummaryDto> {
  return patch<ContentSnapshotSummaryDto>(`/papers/${paperId}/content-versions/${snapshotId}`, data)
}

/** 回滚到该快照；返回覆盖后的正文（含新的 contentVersion） */
export function restoreContentSnapshot(
  paperId: number,
  snapshotId: number,
  data: RestoreContentSnapshotRequest = {},
): Promise<PaperContentDto> {
  return post<PaperContentDto>(`/papers/${paperId}/content-versions/${snapshotId}/restore`, data)
}
