"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Loader2, Eye } from "lucide-react"
import { resolveSharedPaper } from "@/lib/api/shares"
import type { PublicSharePaperDto } from "@/lib/api/types"
import "katex/dist/katex.min.css"

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ok"; paper: PublicSharePaperDto }

/**
 * 只读分享页（W7）。免登录：凭 URL 里的 token 调 /api/share/{token} 拿只读正文。
 * 无效 / 已撤销 / 已过期都当作「链接失效」统一提示，不泄露论文是否存在。
 */
export default function SharePage() {
  const params = useParams()
  const token = Array.isArray(params.token) ? params.token[0] : (params.token ?? "")
  const t = useTranslations("share")
  const [state, setState] = useState<State>({ kind: "loading" })

  useEffect(() => {
    if (!token) {
      setState({ kind: "error" })
      return
    }
    let cancelled = false
    resolveSharedPaper(token)
      .then((paper) => {
        if (!cancelled) setState({ kind: "ok", paper })
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "error" })
      })
    return () => {
      cancelled = true
    }
  }, [token])

  if (state.kind === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--bg-root)] text-[var(--text-tertiary)]">
        <Loader2 className="size-5 animate-spin" />
      </main>
    )
  }

  if (state.kind === "error") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-2 bg-[var(--bg-root)] px-4 text-center">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">{t("invalidTitle")}</h1>
        <p className="text-sm text-[var(--text-tertiary)]">{t("invalidHint")}</p>
      </main>
    )
  }

  const { paper } = state
  return (
    <main className="min-h-screen bg-[var(--bg-root)] px-4 py-10 text-[var(--text-primary)] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-xs text-[var(--text-tertiary)]">
          <Eye className="size-3.5" />
          {t("readOnlyBadge")}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{paper.title}</h1>
        {paper.authors && <p className="mt-2 text-sm text-[var(--text-secondary)]">{paper.authors}</p>}
        {paper.participants && (
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">{paper.participants}</p>
        )}
        {paper.abstractText && (
          <section className="mt-6">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)]">{t("abstract")}</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)] whitespace-pre-wrap">
              {paper.abstractText}
            </p>
          </section>
        )}
        <div className="mt-8">
          {paper.contentHtml ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              // 正文由作者在本站编辑器生成的 HTML，只读展示；与站内编辑器渲染方式一致。
              dangerouslySetInnerHTML={{ __html: paper.contentHtml }}
            />
          ) : (
            <p className="text-sm text-[var(--text-tertiary)]">{t("empty")}</p>
          )}
        </div>
      </div>
    </main>
  )
}
