"use client"

import { useState, useCallback } from "react"
import { Topbar } from "@/components/layout/Topbar"
import { Sidebar } from "@/components/layout/Sidebar"
import { RightPanel } from "@/components/layout/RightPanel"
import { PDFViewer } from "@/components/reader/PDFViewer"
import { PaperList } from "@/components/papers/PaperList"
import { UploadDialog } from "@/components/papers/UploadDialog"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { LangToggle } from "@/components/ui/LangToggle"
import { usePaperStore } from "@/stores/paper-store"
import { X } from "lucide-react"

type SidebarPanel = "library" | null

export default function Home() {
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>(null)
  const [showUpload, setShowUpload] = useState(false)
  const { currentPaper, loadPaper } = usePaperStore()

  const handleSidebarClick = useCallback((key: string) => {
    if (key === "upload") {
      setShowUpload(true)
      return
    }
    if (key === "library") {
      setSidebarPanel((p) => (p === "library" ? null : "library"))
      return
    }
    setSidebarPanel(null)
  }, [])

  const handlePaperSelect = useCallback(
    (id: number) => {
      loadPaper(id)
      setSidebarPanel(null)
    },
    [loadPaper],
  )

  return (
    <div className="h-screen flex overflow-hidden relative" style={{ background: "var(--bg-root)" }}>
      <Sidebar activePanel={sidebarPanel} onNavigate={handleSidebarClick} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar />

        {/* Top-right icon group */}
        <div className="absolute top-0 right-0 flex items-center gap-1 px-3 h-[52px] z-50">
          <LangToggle />
          <ThemeToggle />
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ml-2 cursor-pointer"
            style={{ background: "var(--text-primary)", color: "var(--bg-root, #eeeff2)" }}
            title="用户"
          >
            Y
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Paper list panel (slides in from sidebar) */}
          {sidebarPanel === "library" && (
            <aside className="w-72 border-r border-[var(--border-subtle)] glass-surface flex flex-col shrink-0">
              <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)]">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">My Library</span>
                <button
                  type="button"
                  onClick={() => setSidebarPanel(null)}
                  className="p-0.5 rounded hover:bg-[var(--surface-2)] text-[var(--text-tertiary)]"
                >
                  <X className="size-4" />
                </button>
              </div>
              <PaperList
                activeId={currentPaper?.id ?? null}
                onSelect={handlePaperSelect}
              />
            </aside>
          )}

          <main className="flex-1 overflow-hidden">
            <PDFViewer paper={currentPaper} onUploadClick={() => setShowUpload(true)} />
          </main>

          <RightPanel paper={currentPaper} />
        </div>
      </div>

      <UploadDialog open={showUpload} onClose={() => setShowUpload(false)} />
    </div>
  )
}
