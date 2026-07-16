"use client"

import { useState, useCallback, useEffect } from "react"
import { useTranslations } from "next-intl"
import { PanelRightClose, PanelRightOpen, Pencil, Save, Loader2, MessageSquare, StickyNote, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { usePaperStore } from "@/stores/paper-store"
import { useReaderStore } from "@/stores/reader-store"
import type { ReaderAnnotation, ReaderNote } from "@/stores/reader-store"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { TabBar } from "@/components/ui/TabBar"
import { getCategory, CATEGORIES } from "@/lib/paper-categories"
import { MarkdownContent } from "@/components/reader/MarkdownContent"
import { ChatPanel } from "@/components/chat/ChatPanel"
import { CommentThread } from "@/components/annotations/CommentThread"
import { AnnotationDialog } from "@/components/reader/AnnotationDialog"
import { deleteAnnotation, updateAnnotation } from "@/lib/api/annotations"
import { deleteNote, updateNote } from "@/lib/api/notes"
import { useToastStore } from "@/stores/toast-store"
import type { PaperDetailDto, Category } from "@/lib/api/types"

type PanelTab = "metadata" | "annotations" | "notes" | "aiChat"

interface RightPanelProps {
  paper?: PaperDetailDto | null
}

export function RightPanel({ paper }: RightPanelProps) {
  const t = useTranslations("panel")
  const [activeTab, setActiveTab] = useState<PanelTab>("metadata")
  const [collapsed, setCollapsed] = useState(false)

  const { updateAnnotation: storeUpdateAnnotation, removeAnnotation, updateNote: storeUpdateNote, removeNote } = useReaderStore()
  const addToast = useToastStore((s) => s.addToast)

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editDialogMode, setEditDialogMode] = useState<"annotation" | "note">("annotation")
  const [editItem, setEditItem] = useState<ReaderAnnotation | ReaderNote | null>(null)

  const handleDeleteAnnotation = useCallback(async (id: number) => {
    try {
      await deleteAnnotation(id)
      removeAnnotation(id)
      addToast({ message: "批注已删除", type: "success" })
    } catch {
      addToast({ message: "删除批注失败", type: "error" })
    }
  }, [removeAnnotation, addToast])

  const handleDeleteNote = useCallback(async (id: number) => {
    try {
      await deleteNote(id)
      removeNote(id)
      addToast({ message: "笔记已删除", type: "success" })
    } catch {
      addToast({ message: "删除笔记失败", type: "error" })
    }
  }, [removeNote, addToast])

  const handleEditAnnotation = useCallback((a: ReaderAnnotation) => {
    setEditDialogMode("annotation")
    setEditItem(a)
    setEditDialogOpen(true)
  }, [])

  const handleEditNote = useCallback((n: ReaderNote) => {
    setEditDialogMode("note")
    setEditItem(n)
    setEditDialogOpen(true)
  }, [])

  const handleEditSubmit = useCallback(async (data: { markdown: string; images: string[]; title?: string }) => {
    if (!editItem) return
    if (editDialogMode === "annotation") {
      const a = editItem as ReaderAnnotation
      try {
        const updated = await updateAnnotation(a.id, {
          comment: data.markdown,
          images: data.images,
        })
        const upos = (updated as unknown as Record<string, unknown>).position as Record<string, unknown> | undefined
        storeUpdateAnnotation(a.id, {
          content: updated.comment || data.markdown,
          images: updated.images || data.images,
          position: upos ? { x: Number(upos.x ?? 0), y: Number(upos.y ?? 0), width: Number(upos.width ?? 0), height: Number(upos.height ?? 0) } : a.position,
          quotedText: updated.quotedText || a.quotedText,
        })
        addToast({ message: "批注已更新", type: "success" })
      } catch {
        addToast({ message: "更新批注失败", type: "error" })
      }
    } else {
      const n = editItem as ReaderNote
      try {
        const updated = await updateNote(n.id, {
          content: data.markdown,
          images: data.images,
          title: data.title,
        })
        const upos = (updated as unknown as Record<string, unknown>).position as Record<string, unknown> | undefined
        storeUpdateNote(n.id, {
          content: updated.content,
          images: updated.images || [],
          title: updated.title,
          position: upos ? { x: Number(upos.x ?? 0), y: Number(upos.y ?? 0), width: Number(upos.width ?? 0), height: Number(upos.height ?? 0) } : n.position,
        })
        addToast({ message: "笔记已更新", type: "success" })
      } catch {
        addToast({ message: "更新笔记失败", type: "error" })
      }
    }
    setEditDialogOpen(false)
    setEditItem(null)
  }, [editItem, editDialogMode, storeUpdateAnnotation, storeUpdateNote, addToast])

  const tabs: { key: PanelTab; label: string }[] = [
    { key: "metadata", label: t("metadata") },
    { key: "annotations", label: t("annotations") },
    { key: "notes", label: t("notes") },
    { key: "aiChat", label: t("aiChat") },
  ]

  if (collapsed) {
    return (
      <aside
        className="w-[44px] border-l border-[var(--border-subtle)] flex items-center justify-center shrink-0 transition-all duration-200"
        style={{ background: "var(--surface-1)", backdropFilter: "blur(20px) saturate(180%)" }}
      >
        <button
          onClick={() => setCollapsed(false)}
          title="Expand panel"
          className="p-1 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all"
        >
          <PanelRightOpen className="w-[15px] h-[15px]" />
        </button>
      </aside>
    )
  }

  return (
    <aside
      className="w-[380px] border-l border-[var(--border-subtle)] flex flex-col select-none shrink-0 transition-all duration-200"
      style={{ background: "var(--surface-1)", backdropFilter: "blur(20px) saturate(180%)" }}
    >
      <nav className="flex border-b border-[var(--border-subtle)] items-center pr-2">
        <div className="flex-1">
          <TabBar tabs={tabs} activeKey={activeTab} onChange={(k) => setActiveTab(k as PanelTab)} />
        </div>
        <button
          onClick={() => setCollapsed(true)}
          title="Collapse panel"
          className="ml-1 p-1 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all shrink-0"
        >
          <PanelRightClose className="w-[15px] h-[15px]" />
        </button>
      </nav>

      <div className="flex-1 overflow-auto p-4">
        {activeTab === "metadata" && <MetadataContent paper={paper} />}
        {activeTab === "annotations" && (
          <AnnotationList
            onEdit={handleEditAnnotation}
            onDelete={handleDeleteAnnotation}
          />
        )}
        {activeTab === "notes" && (
          <NoteList
            onEdit={handleEditNote}
            onDelete={handleDeleteNote}
          />
        )}
        {activeTab === "aiChat" && <ChatPanel />}
      </div>

      {/* Edit dialog */}
      {editItem && (
        <AnnotationDialog
          open={editDialogOpen}
          onClose={() => { setEditDialogOpen(false); setEditItem(null) }}
          onSubmit={handleEditSubmit}
          mode={editDialogMode}
          selectedText={"quotedText" in editItem ? (editItem as ReaderAnnotation).quotedText : (editItem as ReaderNote).quotedText}
          initialMarkdown={"content" in editItem ? editItem.content : ""}
          initialImages={"images" in editItem ? editItem.images : []}
          initialTitle={editDialogMode === "note" ? (editItem as ReaderNote).title : undefined}
        />
      )}
    </aside>
  )
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  UPLOAD: "PDF Upload",
  URL: "URL Import",
  MANUAL: "Manual",
}

function formatFileSize(bytes?: number): string {
  if (bytes == null) return "--"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso?: string): string {
  if (!iso) return "--"
  const d = new Date(iso)
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }) +
    " " + d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface-2)] shadow-[var(--shadow-sm)] overflow-hidden">
      <h3 className="text-[11px] font-[650] text-[var(--text-tertiary)] uppercase tracking-[0.6px] px-4 pt-3.5 pb-2">
        {title}
      </h3>
      <div className="px-4 pb-3.5 space-y-0.5">
        {children}
      </div>
    </div>
  )
}

function FieldRow({ label, children, editing }: { label: string; children?: React.ReactNode; editing?: boolean }) {
  return (
    <div className="flex items-start py-1.5 border-b border-[var(--border-subtle)] last:border-0 text-[13px] gap-3">
      <span className="text-[12px] text-[var(--text-tertiary)] min-w-[64px] shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

function DisplayValue({ value, mono }: { value: string | number | undefined | null; mono?: boolean }) {
  const display = value != null && value !== "" ? String(value) : "--"
  return (
    <span className={cn(
      "text-[var(--text-primary)] text-right flex-1 min-w-0 break-all",
      mono && "font-mono text-[11px]",
      !mono && "font-[470]",
      (value == null || value === "") && "text-[var(--text-tertiary)] italic"
    )}>
      {display}
    </span>
  )
}

function MetadataContent({ paper }: { paper?: PaperDetailDto | null }) {
  const t = useTranslations("metadata")
  const tp = useTranslations("paper")
  const tPapers = useTranslations("papers")

  const updatePaper = usePaperStore((s) => s.updatePaper)

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Editable form state
  const [title, setTitle] = useState("")
  const [authors, setAuthors] = useState("")
  const [participants, setParticipants] = useState("")
  const [abstractText, setAbstractText] = useState("")
  const [doi, setDoi] = useState("")
  const [year, setYear] = useState("")
  const [journal, setJournal] = useState("")
  const [category, setCategory] = useState<Category>("JOURNAL")
  const [extraFields, setExtraFields] = useState<Record<string, string>>({})

  // Sync form state when paper changes or editing toggles
  useEffect(() => {
    if (paper) {
      setTitle(paper.title ?? "")
      setAuthors(paper.authors ?? "")
      setParticipants(paper.participants ?? "")
      setAbstractText(paper.abstractText ?? "")
      setDoi(paper.doi ?? "")
      setYear(paper.year?.toString() ?? "")
      setJournal(paper.journal ?? "")
      setCategory(paper.category)
      const ef = paper.extraFields || {}
      const result: Record<string, string> = {}
      for (const [k, v] of Object.entries(ef)) {
        result[k] = typeof v === "string" ? v : ""
      }
      setExtraFields(result)
    }
  }, [paper, editing])

  const handleSave = useCallback(async () => {
    if (!paper) return
    setSaving(true)
    try {
      await updatePaper(paper.id, {
        title: title.trim() || undefined,
        authors: authors.trim() || undefined,
        participants: participants.trim() || undefined,
        abstractText: abstractText.trim() || undefined,
        category,
        extraFields: Object.keys(extraFields).length > 0 ? extraFields : undefined,
        doi: doi.trim() || undefined,
        year: year.trim() || undefined,
        journal: journal.trim() || undefined,
      })
      setEditing(false)
    } catch {
      // error handled in store
    } finally {
      setSaving(false)
    }
  }, [paper, title, authors, participants, abstractText, category, extraFields, doi, year, journal, updatePaper])

  const handleCancel = useCallback(() => {
    setEditing(false)
  }, [])

  const handleExtraField = useCallback((key: string, value: string) => {
    setExtraFields((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleCategoryChange = useCallback((newCat: Category) => {
    setCategory(newCat)
    setExtraFields({})
  }, [])

  if (!paper) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-[var(--text-tertiary)]">Select a paper</p>
      </div>
    )
  }

  const catDef = getCategory(paper.category)

  return (
    <div className="space-y-3 pb-6">
      {/* Edit / Save toolbar */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] text-[var(--text-tertiary)]">
          {editing ? t("editing") : ""}
        </span>
        {editing ? (
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="secondary" onClick={handleCancel} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Save className="size-3" />
              )}
              <span className="ml-1">Save</span>
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 text-[11.5px] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
          >
            <Pencil className="size-3" />
            {t("edit")}
          </button>
        )}
      </div>

      {/* Section: Basic Info */}
      <SectionCard title={tp("basicInfo")}>
        <FieldRow label={t("title")} editing={editing}>
          {editing ? (
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          ) : (
            <DisplayValue value={paper.title} />
          )}
        </FieldRow>
        <FieldRow label={t("authors")} editing={editing}>
          {editing ? (
            <Input value={authors} onChange={(e) => setAuthors(e.target.value)} />
          ) : (
            <DisplayValue value={paper.authors} />
          )}
        </FieldRow>
        <FieldRow label={t("participants")} editing={editing}>
          {editing ? (
            <Input value={participants} onChange={(e) => setParticipants(e.target.value)} />
          ) : (
            <DisplayValue value={paper.participants} />
          )}
        </FieldRow>
        {paper.tags && paper.tags.length > 0 && (
          <FieldRow label={tPapers("tags")}>
            <div className="flex flex-wrap gap-1">
              {paper.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20"
                >
                  {tag}
                </span>
              ))}
            </div>
          </FieldRow>
        )}
      </SectionCard>

      {/* Abstract — always show as its own card */}
      {(paper.abstractText || editing) && (
        <SectionCard title={t("abstract")}>
          {editing ? (
            <textarea
              rows={4}
              value={abstractText}
              onChange={(e) => setAbstractText(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-0)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]/40 resize-none"
            />
          ) : (
            <p className="text-[12.5px] text-[var(--text-secondary)] leading-[1.65]">
              {paper.abstractText || t("noAbstract")}
            </p>
          )}
        </SectionCard>
      )}

      {/* Section: Publication Info */}
      <SectionCard title={t("publicationInfo")}>
        <FieldRow label={t("year")} editing={editing}>
          {editing ? (
            <Input value={year} onChange={(e) => setYear(e.target.value)} />
          ) : (
            <DisplayValue value={paper.year} />
          )}
        </FieldRow>
        <FieldRow label={t("journal")} editing={editing}>
          {editing ? (
            <Input value={journal} onChange={(e) => setJournal(e.target.value)} />
          ) : (
            <DisplayValue value={paper.journal} />
          )}
        </FieldRow>
        <FieldRow label={t("doi")} editing={editing}>
          {editing ? (
            <Input value={doi} onChange={(e) => setDoi(e.target.value)} />
          ) : (
            <DisplayValue value={paper.doi} mono />
          )}
        </FieldRow>
      </SectionCard>

      {/* Section: Classification */}
      <SectionCard title={t("category")}>
        <FieldRow label={t("category")} editing={editing}>
          {editing ? (
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value as Category)}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-0)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]/40"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          ) : (
            <DisplayValue value={catDef.label} />
          )}
        </FieldRow>
        {editing && catDef.fields.map((field) => (
          <FieldRow key={field.key} label={field.label} editing>
            {field.type === "textarea" ? (
              <textarea
                rows={3}
                value={extraFields[field.key] || ""}
                onChange={(e) => handleExtraField(field.key, e.target.value)}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-0)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]/40 resize-none"
              />
            ) : field.type === "select" ? (
              <select
                value={extraFields[field.key] || ""}
                onChange={(e) => handleExtraField(field.key, e.target.value)}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-0)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]/40"
              >
                <option value="">--</option>
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : field.type === "date" ? (
              <Input type="date" value={extraFields[field.key] || ""} onChange={(e) => handleExtraField(field.key, e.target.value)} />
            ) : (
              <Input value={extraFields[field.key] || ""} onChange={(e) => handleExtraField(field.key, e.target.value)} />
            )}
          </FieldRow>
        ))}
        {!editing && catDef.fields.map((field) => {
          const val = paper.extraFields?.[field.key]
          const display = val != null && val !== "" ? String(val) : "--"
          return (
            <FieldRow key={field.key} label={field.label}>
              <DisplayValue value={val != null ? String(val) : null} />
            </FieldRow>
          )
        })}
        {!editing && catDef.fields.length === 0 && Object.keys(paper.extraFields || {}).length === 0 && (
          <p className="text-[12px] text-[var(--text-tertiary)] py-1">{t("noExtraFields")}</p>
        )}
      </SectionCard>

      {/* Section: File Info */}
      <SectionCard title={t("fileInfo")}>
        <FieldRow label={t("sourceType")}>
          <DisplayValue value={SOURCE_TYPE_LABELS[paper.sourceType] || paper.sourceType} />
        </FieldRow>
        {paper.sourceUrl && (
          <FieldRow label={t("sourceUrl")}>
            <DisplayValue value={paper.sourceUrl} mono />
          </FieldRow>
        )}
        <FieldRow label={t("pageCount")}>
          <DisplayValue value={paper.pageCount} />
        </FieldRow>
        <FieldRow label={t("fileSize")}>
          <DisplayValue value={formatFileSize(paper.fileSize)} />
        </FieldRow>
      </SectionCard>

      {/* Section: System Info */}
      <SectionCard title={t("systemInfo")}>
        <FieldRow label={t("id")}>
          <DisplayValue value={paper.id} mono />
        </FieldRow>
        <FieldRow label={t("createdAt")}>
          <DisplayValue value={formatDate(paper.createdAt)} mono />
        </FieldRow>
        <FieldRow label={t("updatedAt")}>
          <DisplayValue value={formatDate(paper.updatedAt)} mono />
        </FieldRow>
      </SectionCard>

      {/* Section: GROBID Result */}
      {paper.grobidResult && Object.keys(paper.grobidResult).length > 0 && (
        <SectionCard title={t("grobidResult")}>
          <pre className="text-[11px] text-[var(--text-secondary)] font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
            {JSON.stringify(paper.grobidResult, null, 2)}
          </pre>
        </SectionCard>
      )}
    </div>
  )
}

function AnnotationList({ onEdit, onDelete }: { onEdit: (a: ReaderAnnotation) => void; onDelete: (id: number) => void }) {
  const { annotations, loadAnnotations, loadingAnnotations } = useReaderStore()
  const paper = usePaperStore((s) => s.currentPaper)

  useEffect(() => {
    if (paper?.id) loadAnnotations(paper.id)
  }, [paper?.id, loadAnnotations])

  if (loadingAnnotations && annotations.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="size-5 animate-spin text-[var(--text-tertiary)]" />
      </div>
    )
  }

  if (annotations.length === 0) {
    return <EmptyState message="暂无批注" />
  }

  const sorted = [...annotations].sort((a, b) => a.pageNumber - b.pageNumber)

  return (
    <div className="space-y-3 pb-6">
      {sorted.map((a) => (
        <div key={a.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] overflow-hidden relative group">
          {/* Action buttons — top-right */}
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <button
              onClick={() => onEdit(a)}
              className="p-1 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
              title="编辑批注"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              onClick={() => onDelete(a.id)}
              className="p-1 rounded-md hover:bg-red-50 text-[var(--text-tertiary)] hover:text-red-500 transition-colors"
              title="删除批注"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
          {/* 引用原文 */}
          <div className="px-4 py-2.5 bg-[var(--bg-hover)] border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-1.5 mb-1">
              <MessageSquare className="size-3 text-[var(--text-tertiary)]" />
              <span className="text-[10.5px] text-[var(--text-tertiary)] uppercase tracking-wide">
                引用原文 · 第{a.pageNumber}页
              </span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-4">
              {a.quotedText}
            </p>
          </div>
          {/* 批注内容 */}
          <div className="px-4 py-3">
            <MarkdownContent
              content={a.content}
              images={a.images}
              className="text-sm text-[var(--text-primary)] leading-relaxed"
            />
          </div>
          {/* 评论区域 + 时间 */}
          <div className="px-4 pb-2.5 flex items-center justify-between">
            <CommentThreadButton annotationId={a.id} commentCount={a.commentCount} />
            <span className="text-[10.5px] text-[var(--text-tertiary)]">
              {formatDate(a.createdAt)}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function CommentThreadButton({ annotationId, commentCount }: { annotationId: number; commentCount: number }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
      >
        <MessageSquare className="size-3" />
        <span>{commentCount > 0 ? `${commentCount} 条评论` : "评论"}</span>
      </button>
      {expanded && (
        <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
          <CommentThread annotationId={annotationId} />
        </div>
      )}
    </div>
  )
}

function NoteList({ onEdit, onDelete }: { onEdit: (n: ReaderNote) => void; onDelete: (id: number) => void }) {
  const { notes, loadNotes, loadingNotes } = useReaderStore()
  const paper = usePaperStore((s) => s.currentPaper)

  useEffect(() => {
    if (paper?.id) loadNotes(paper.id)
  }, [paper?.id, loadNotes])

  if (loadingNotes && notes.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="size-5 animate-spin text-[var(--text-tertiary)]" />
      </div>
    )
  }

  if (notes.length === 0) {
    return <EmptyState message="暂无笔记" />
  }

  const sorted = [...notes].sort((a, b) => a.pageNumber - b.pageNumber)

  return (
    <div className="space-y-3 pb-6">
      {sorted.map((n) => (
        <div key={n.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] overflow-hidden relative group">
          {/* Action buttons — top-right */}
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <button
              onClick={() => onEdit(n)}
              className="p-1 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
              title="编辑笔记"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              onClick={() => onDelete(n.id)}
              className="p-1 rounded-md hover:bg-red-50 text-[var(--text-tertiary)] hover:text-red-500 transition-colors"
              title="删除笔记"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
          {/* 引用原文 */}
          <div className="px-4 py-2.5 bg-[var(--bg-hover)] border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-1.5 mb-1">
              <StickyNote className="size-3 text-[var(--text-tertiary)]" />
              <span className="text-[10.5px] text-[var(--text-tertiary)] uppercase tracking-wide">
                引用原文 · 第{n.pageNumber}页
              </span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-4">
              {n.quotedText}
            </p>
          </div>
          {/* 笔记内容 */}
          <div className="px-4 py-3">
            {n.title && (
              <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">{n.title}</h4>
            )}
            <MarkdownContent
              content={n.content}
              images={n.images}
              className="text-sm text-[var(--text-primary)] leading-relaxed"
            />
          </div>
          {/* 时间 */}
          <div className="px-4 pb-2.5">
            <span className="text-[10.5px] text-[var(--text-tertiary)]">
              {formatDate(n.createdAt)}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <span className="text-sm text-[var(--text-tertiary)]">{message}</span>
    </div>
  )
}
