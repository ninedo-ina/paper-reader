"use client"

import { useEffect } from "react"

/**
 * 离开页面前的未保存拦截。分两条路径：
 * 1. `beforeunload`——关闭标签页 / 刷新 / 地址栏跳转等浏览器级离开，触发浏览器原生确认框。
 * 2. 应用内路由切换——捕获阶段拦截 `<a>` 点击，抢在 Next.js `<Link>` 前面弹自定义确认。
 *
 * 只有 active（存在未保存改动）时才挂监听，干净状态下不打扰用户。
 */
export function useUnsavedGuard(active: boolean, confirmMessage: string) {
  useEffect(() => {
    if (!active) return

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // 现代浏览器忽略自定义文案，但仍需设置 returnValue 才会弹出原生确认框。
      e.returnValue = ""
      return ""
    }

    const onClickCapture = (e: MouseEvent) => {
      // 只拦「普通左键点击」：带修饰键、非左键、已被其它处理器取消的都放行。
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const target = e.target as HTMLElement | null
      const anchor = target?.closest?.("a")
      if (!anchor) return
      const href = anchor.getAttribute("href")
      if (!href || href.startsWith("#") || anchor.target === "_blank" || anchor.hasAttribute("download")) return
      let dest: URL
      try {
        dest = new URL(href, window.location.href)
      } catch {
        return
      }
      // 跳到当前地址（含纯锚点）不算离开。
      if (dest.href === window.location.href) return
      if (!window.confirm(confirmMessage)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    window.addEventListener("beforeunload", onBeforeUnload)
    document.addEventListener("click", onClickCapture, true)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      document.removeEventListener("click", onClickCapture, true)
    }
  }, [active, confirmMessage])
}
