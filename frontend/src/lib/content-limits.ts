import type { ContentLimitsDto } from "@/lib/api/types"
import { CONTENT_TOO_LARGE_CODE, type AutosaveRejection } from "@/hooks/useAutosave"
import { utf8ByteLength } from "@/lib/utils"

/** 编辑器 payload 里与体积有关的两部分：权威节点树 + 派生 HTML */
export interface SizedContent {
  contentJson: unknown
  contentHtml: string
}

/**
 * 提交前自检正文体积。超限就返回拒绝原因（含实际/上限字节数，供文案把话说清楚），
 * 否则返回 null。
 *
 * 服务端才是权威判定（同样超限会回 1014/413），这里只是避免把注定被拒的正文
 * 反复发上去——一份 8MB 的正文，每 2 秒重发一次，写放大就是这么来的。
 * 拿不到限额（limits 为 null）时不拦，交给服务端。
 */
export function checkContentSize(
  content: SizedContent,
  limits: ContentLimitsDto | null,
): AutosaveRejection | null {
  if (!limits) return null

  // 与后端一致：contentJson 按序列化后的 UTF-8 字节计，contentHtml 按渲染结果计
  const jsonSize = utf8ByteLength(JSON.stringify(content.contentJson ?? null))
  if (jsonSize > limits.maxJsonBytes) {
    return { code: CONTENT_TOO_LARGE_CODE, size: jsonSize, limit: limits.maxJsonBytes }
  }

  const htmlSize = utf8ByteLength(content.contentHtml)
  if (htmlSize > limits.maxHtmlBytes) {
    return { code: CONTENT_TOO_LARGE_CODE, size: htmlSize, limit: limits.maxHtmlBytes }
  }

  return null
}
