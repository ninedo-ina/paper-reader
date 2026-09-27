// =============================================================================
// 只读分享链接 API（W7）— 作者签发/列出/撤销；公开侧免登录读取
// =============================================================================

import { get, post, del } from "./client"
import type {
  CreateShareRequest,
  PublicSharePaperDto,
  ShareLinkDto,
} from "./types"

export function createShareLink(
  paperId: number,
  data: CreateShareRequest = {},
): Promise<ShareLinkDto> {
  return post<ShareLinkDto>(`/papers/${paperId}/shares`, data)
}

export function listShareLinks(paperId: number): Promise<ShareLinkDto[]> {
  return get<ShareLinkDto[]>(`/papers/${paperId}/shares`)
}

export function revokeShareLink(paperId: number, shareId: number): Promise<null> {
  return del<null>(`/papers/${paperId}/shares/${shareId}`)
}

/** 免登录：凭 token 读取只读正文。无效/撤销/过期都会抛 code=1014 的错误。 */
export function resolveSharedPaper(token: string): Promise<PublicSharePaperDto> {
  return get<PublicSharePaperDto>(`/share/${encodeURIComponent(token)}`)
}
