"use client"

import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { PaperCard } from "@/components/papers/PaperCard"
import { usePaperStore } from "@/stores/paper-store"
import { useAuthStore } from "@/stores/auth-store"
import { useEffect, useState } from "react"
import Link from "next/link"
import { FileText } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { DeletePaperDialog } from "@/components/papers/DeletePaperDialog"
import { useToastStore } from "@/stores/toast-store"
import { ToastContainer } from "@/components/ui/Toast"

export default function PapersPage() {
  const t = useTranslations("nav")
  const c = useTranslations("common")
  const tp = useTranslations("papers")
  const { papers, isListLoading, loadPapers, deletePaper } = usePaperStore()
  const accessToken = useAuthStore((s) => s.accessToken)
  const router = useRouter()
  const [deletePaperId, setDeletePaperId] = useState<number | null>(null)
  const deleteTarget = papers.find((paper) => paper.id === deletePaperId) ?? null
  const addToast = useToastStore((state) => state.addToast)

  useEffect(() => {
    if (accessToken) {
      loadPapers(0)
    }
  }, [accessToken, loadPapers])

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
                onClick={() => router.push(`/papers/${paper.id}`)}
                onDelete={() => setDeletePaperId(paper.id)}
              />
            ))}
          </div>
        )}
        <DeletePaperDialog
          open={deleteTarget !== null}
          paperTitle={deleteTarget?.title ?? ""}
          hasOriginalFile={deleteTarget?.hasOriginalFile ?? false}
          onClose={() => setDeletePaperId(null)}
          onConfirm={async (deleteFile) => {
            if (!deleteTarget) return
            await deletePaper(deleteTarget.id, deleteFile)
            addToast({ message: tp("deleteSuccess"), type: "success" })
          }}
        />
        <ToastContainer />
      </div>
    </div>
  )
}
