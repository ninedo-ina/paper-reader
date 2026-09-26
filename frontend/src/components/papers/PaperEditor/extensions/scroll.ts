import type { Editor } from "@tiptap/react"

/**
 * 按属性值逐个比对来找元素，不用 CSS 选择器拼串：
 * 引用条目的 id 可能来自 DOI 或 URL，里面有斜杠、括号甚至引号，
 * 拼进选择器要么语法报错，要么必须再引一层 CSS.escape，不划算。
 */
export function findAnnotatedElement(
  editor: Editor,
  attribute: string,
  value: string,
): HTMLElement | null {
  const candidates = editor.view.dom.querySelectorAll<HTMLElement>(`[${attribute}]`)
  for (const element of candidates) {
    if (element.getAttribute(attribute) === value) return element
  }
  return null
}

export function flashElement(element: HTMLElement): void {
  element.classList.remove("academic-flash")
  // 强制一次样式重算，否则连续点击同一个目标时动画不会重播
  void element.offsetWidth
  element.classList.add("academic-flash")
  window.setTimeout(() => element.classList.remove("academic-flash"), 1200)
}

/** 从正文跳转到文末的脚注/参考文献条目：滚到中间并闪一下，用户才知道跳到了哪一条。 */
export function revealAnnotation(editor: Editor, attribute: string, value: string): void {
  const element = findAnnotatedElement(editor, attribute, value)
  if (!element) return
  element.scrollIntoView({ block: "center", behavior: "smooth" })
  flashElement(element)
}
