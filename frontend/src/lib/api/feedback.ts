import { postForm } from "./client"

/** 提交反馈后的回执。本轮没有查看页，服务端只回 id 与截图张数。 */
export interface FeedbackReceipt {
  id: number
  screenshotCount: number
}

export interface FeedbackInput {
  title: string
  content: string
  /** 页面路径，如 `/zh/reader/123`——出问题时能直接回到那一屏 */
  pagePath: string
  /** 客户端版本，构建时由 next.config 从 VERSION 注入 */
  appVersion: string
  /** 界面语言 */
  locale: string
}

/**
 * 提交问题反馈。截图走 multipart 一起带上；浏览器 UA 不在表单里，
 * 服务端直接读请求头（客户端自报的 UA 不可信）。
 */
export function submitFeedback(input: FeedbackInput, screenshots: File[]): Promise<FeedbackReceipt> {
  const form = new FormData()
  form.append("title", input.title)
  form.append("content", input.content)
  form.append("pagePath", input.pagePath)
  form.append("appVersion", input.appVersion)
  form.append("locale", input.locale)
  for (const shot of screenshots) form.append("screenshots", shot)
  return postForm<FeedbackReceipt>("/feedback", form)
}
