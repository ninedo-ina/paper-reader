"use client"

import { useState, useCallback, useEffect } from "react"
import { Topbar } from "@/components/layout/Topbar"
import { Sidebar } from "@/components/layout/Sidebar"
import { RightPanel } from "@/components/layout/RightPanel"
import { PaperList } from "@/components/papers/PaperList"
import { UploadDialog } from "@/components/papers/UploadDialog"
import { CreatePaperDialog } from "@/components/papers/CreatePaperDialog"
import { PaperContentArea } from "@/components/papers/PaperContentArea"
import { VersionPopup } from "@/components/layout/VersionPopup"
import { ToastContainer } from "@/components/ui/Toast"
import { HistoryPanel } from "@/components/history/HistoryPanel"
import { NotesPanel } from "@/components/notes/NotesPanel"
import { PreferencesDialog } from "@/components/settings/PreferencesDialog"
import { ProfileDialog } from "@/components/settings/ProfileDialog"
import { ForumPage } from "@/components/forum/ForumPage"
import { ChatsPage } from "@/components/chat/ChatsPage"
import { usePaperStore } from "@/stores/paper-store"
import { useNotificationStore } from "@/stores/notification-store"
import type { NoteDto } from "@/lib/api/types"

type SidebarPanel = "library" | "history" | "notes" | "starred" | null
type MainView = "reader" | "forum" | "chats"

export default function Home() {
  const [mainView, setMainView] = useState<MainView>("reader")
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>("library")
  const [showUpload, setShowUpload] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showPreferences, setShowPreferences] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const { currentPaper, loadPaper } = usePaperStore()
  const initSystemNotifications = useNotificationStore((s) => s.initSystemNotifications)

  useEffect(() => {
    initSystemNotifications()
  }, [initSystemNotifications])

  const handleSidebarClick = useCallback((key: string) => {
    if (key === "circle") {
      setMainView("forum")
      setSidebarPanel(null)
      return
    }
    if (key === "chats") {
      setMainView("chats")
      setSidebarPanel(null)
      return
    }
    if (key === "upload") {
      setShowUpload(true)
      return
    }
    if (key === "settings") {
      setShowPreferences(true)
      return
    }
    // Reader sidebar panels
    setMainView("reader")
    if (key === "starred") {
      setSidebarPanel((p) => (p === "starred" ? null : "starred"))
      return
    }
    if (key === "library" || key === "history" || key === "notes") {
      setSidebarPanel((p) => (p === key ? null : key as SidebarPanel))
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

  const showReaderPanel = mainView === "reader"

  return (
    <div className="h-screen flex overflow-hidden relative" style={{ background: "var(--bg-root)" }}>
      <Sidebar activePanel={sidebarPanel} onNavigate={handleSidebarClick} />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onProfile={() => setShowProfile(true)} />

        <div className="flex-1 flex overflow-hidden">
          {/* Paper list panel (slides in from sidebar) */}
          {showReaderPanel && sidebarPanel === "library" && (
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

          {/* History panel */}
          {showReaderPanel && sidebarPanel === "history" && (
            <aside className="w-72 border-r border-[var(--border-subtle)] glass-surface flex flex-col shrink-0">
              <HistoryPanel
                onSelect={handlePaperSelect}
                onClose={() => setSidebarPanel(null)}
              />
            </aside>
          )}

          {/* Notes panel */}
          {showReaderPanel && sidebarPanel === "notes" && (
            <aside className="w-72 border-r border-[var(--border-subtle)] glass-surface flex flex-col shrink-0">
              <NotesPanel
                activeNoteId={null}
                onSelect={(note: NoteDto) => handlePaperSelect(note.paperId)}
                onClose={() => setSidebarPanel(null)}
              />
            </aside>
          )}

          {/* Starred panel */}
          {showReaderPanel && sidebarPanel === "starred" && (
            <aside className="w-72 border-r border-[var(--border-subtle)] glass-surface flex flex-col shrink-0">
              <PaperList
                activeId={currentPaper?.id ?? null}
                onSelect={handlePaperSelect}
                onClose={() => setSidebarPanel(null)}
                favoriteMode
              />
            </aside>
          )}

          {mainView === "forum" && (
            <main className="flex-1 overflow-hidden">
              <ForumPage />
            </main>
          )}

          {mainView === "chats" && (
            <main className="flex-1 overflow-hidden">
              <ChatsPage />
            </main>
          )}

          {showReaderPanel && (
            <main className="flex-1 overflow-hidden flex flex-col">
              <PaperContentArea paper={currentPaper} onUploadClick={() => setShowUpload(true)} />
            </main>
          )}

          {showReaderPanel && <RightPanel paper={currentPaper} />}
        </div>
      </div>

      <UploadDialog
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onUploaded={() => setSidebarPanel("library")}
      />
      <CreatePaperDialog open={showCreate} onClose={() => setShowCreate(false)} />
      <PreferencesDialog open={showPreferences} onClose={() => setShowPreferences(false)} />
      <ProfileDialog open={showProfile} onClose={() => setShowProfile(false)} />
      <VersionPopup />
      <ToastContainer />
    </div>
  )
}
