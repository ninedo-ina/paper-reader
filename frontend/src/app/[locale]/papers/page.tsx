"use client"

import { useTranslations } from "next-intl"
import { PaperCard } from "@/components/papers/PaperCard"
import { usePaperStore } from "@/stores/paper-store"
import { useEffect } from "react"
import Link from "next/link"
import { FileText } from "lucide-react"
import { Button } from "@/components/ui/Button"

export default function PapersPage() {
  const t = useTranslations("nav")
  const c = useTranslations("common")
  const { papers, isListLoading, loadPapers, deletePaper } = usePaperStore()

  useEffect(() => {
    loadPapers(1)
  }, [loadPapers])

  return (
    <div className="min-h-screen bg-[var(--surface-1)]">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">
            {t("library")}
          </h1>
          <Link href="/">
            <Button variant="secondary" size="sm">
              <FileText className="size-4 mr-1.5" />
              Reader
            </Button>
          </Link>
        </div>

        {isListLoading ? (
          <p className="text-sm text-[var(--text-tertiary)] text-center py-12">{c("loading")}</p>
        ) : papers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-[var(--text-tertiary)]">{c("noData")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {papers.map((paper) => (
              <PaperCard
                key={paper.id}
                paper={paper}
                onClick={() => window.location.href = "/"}
                onDelete={() => { if (confirm("Delete this paper?")) deletePaper(paper.id) }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
