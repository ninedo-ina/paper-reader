"use client"

import { useEffect, useState } from "react"
import { getContentLimits } from "@/lib/api/papers"
import type { ContentLimitsDto } from "@/lib/api/types"

/**
 * 进程内共享一次请求：同时开多个编辑器（多标签页内导航）不必各打一遍。
 * 失败也缓存成 null —— 限额只用于提交前自检，拿不到就退回「全靠服务端拦」，
 * 不该为此反复重试、更不该挡住写作。
 */
let cached: Promise<ContentLimitsDto | null> | null = null

function load(): Promise<ContentLimitsDto | null> {
  if (!cached) {
    cached = getContentLimits().catch(() => null)
  }
  return cached
}

/** 仅供测试清掉进程内缓存 */
export function resetContentLimitsCache(): void {
  cached = null
}

/** 读取正文体积上限与快照保留策略（W9）；未就绪或读取失败时为 null */
export function useContentLimits(): ContentLimitsDto | null {
  const [limits, setLimits] = useState<ContentLimitsDto | null>(null)

  useEffect(() => {
    let cancelled = false
    void load().then((value) => {
      if (!cancelled) setLimits(value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return limits
}
