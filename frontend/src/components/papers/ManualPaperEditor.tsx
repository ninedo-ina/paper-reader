"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import type { JSONContent } from "@tiptap/react"
import { PaperEditor, type PaperContentPayload } from "@/components/papers/PaperEditor"
import { getPaperContent, updatePaperContent } from "@/lib/api/papers"
import type { PaperDetailDto } from "@/lib/api/types"

/**
 * Loads a manually-created paper's persisted body (W1 content API), then mounts
 * the editor. On load failure the editor is intentionally NOT mounted: we never
 * start from a blank document and risk overwriting a body that merely failed to
 * fetch.
 */
export function ManualPaperEditor({ paper }: { paper: PaperDetailDto }) {
  const tc = useTranslations("common")
  const [content, setContent] = useState<JSONContent | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")

  useEffect(() => {
    let cancelled = false
    setStatus("loading")
    getPaperContent(paper.id)
      .then((dto) => {
        if (cancelled) return
        setContent(dto.contentJson)
        setStatus("ready")
      })
      .catch(() => {
        if (!cancelled) setStatus("error")
      })
    return () => {
      cancelled = true
    }
  }, [paper.id])

  const handleSave = useCallback(
    async (payload: PaperContentPayload) => {
      await updatePaperContent(paper.id, payload)
    },
    [paper.id],
  )

  if (status !== "ready") {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: "var(--bg-root)" }}>
        <p className="text-sm text-[var(--text-tertiary)]">
          {status === "loading" ? tc("loadingEditor") : tc("error")}
        </p>
      </div>
    )
  }

  return <PaperEditor paper={paper} content={content} onSave={handleSave} />
}
