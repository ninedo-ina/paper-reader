/**
 * 复制一段文本到剪贴板。
 *
 * 优先用 Clipboard API：它在 https / localhost 下才可用，
 * 内网 http 部署或旧浏览器里 navigator.clipboard 是 undefined，
 * 这时回退到临时 textarea + execCommand，失败会抛出异常由调用方提示。
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  fallbackCopy(text)
}

function fallbackCopy(text: string) {
  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand("copy")
  document.body.removeChild(textarea)
}
