"use client"

import { useState, useCallback, useEffect } from "react"
import { Topbar } from "@/components/layout/Topbar"
import { Sidebar } from "@/components/layout/Sidebar"
import { RightPanel } from "@/components/layout/RightPanel"
import { PDFViewer } from "@/components/reader/PDFViewer"
import { PaperList } from "@/components/papers/PaperList"
import { UploadDialog } from "@/components/papers/UploadDialog"
import { CreatePaperDialog } from "@/components/papers/CreatePaperDialog"
import { PaperEditor } from "@/components/papers/PaperEditor"
import { VersionPopup } from "@/components/layout/VersionPopup"
import { usePaperStore } from "@/stores/paper-store"
import { useNotificationStore } from "@/stores/notification-store"

type SidebarPanel = "library" | null

export default function Home() {
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const { currentPaper, loadPaper } = usePaperStore()
  const initSystemNotifications = useNotificationStore((s) => s.initSystemNotifications)

  useEffect(() => {
    initSystemNotifications()
  }, [initSystemNotifications])

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

        <div className="flex-1 flex overflow-hidden">
          {/* Paper list panel (slides in from sidebar) */}
          {sidebarPanel === "library" && (
            <aside className="w-72 border-r border-[var(--border-subtle)] glass-surface flex flex-col shrink-0">
              <PaperList
                activeId={currentPaper?.id ?? null}
                onSelect={handlePaperSelect}
                onUpload={() => setShowUpload(true)}
                onCreate={() => setShowCreate(true)}
                onClose={() => setSidebarPanel(null)}
              />
            </aside>
          )}

          <main className="flex-1 overflow-hidden">
            {currentPaper?.sourceType === "MANUAL" ? (
              <PaperEditor paper={currentPaper} />
            ) : (
              <PDFViewer paper={currentPaper} onUploadClick={() => setShowUpload(true)} />
            )}
          </main>

          <RightPanel paper={currentPaper} />
        </div>
      </div>

      <UploadDialog open={showUpload} onClose={() => setShowUpload(false)} />
      <CreatePaperDialog open={showCreate} onClose={() => setShowCreate(false)} />
      <VersionPopup />
    </div>
  )
}
