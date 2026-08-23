"use client"

import { useTheme } from "next-themes"
import { useEffect } from "react"

export function FaviconThemeSync() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const variant = resolvedTheme === "dark" ? "dark" : "light"
    const href = `/paperread-favicon-${variant}.svg?v=0.1.17-fix-r1`
    const links = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'),
    )

    if (links.length === 0) {
      const link = document.createElement("link")
      link.rel = "icon"
      link.type = "image/svg+xml"
      link.href = href
      document.head.appendChild(link)
      return
    }

    links.forEach((link) => {
      link.type = "image/svg+xml"
      link.href = href
    })
  }, [resolvedTheme])

  return null
}
