"use client"

import { useState, useCallback, useEffect } from "react"
import { useTranslations } from "next-intl"
import { PanelRightClose, PanelRightOpen, Pencil, Save, Loader2, MessageSquare, StickyNote, Trash2, RefreshCw, Check, ExternalLink, AlertCircle, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { usePaperStore } from "@/stores/paper-store"
import { useReaderStore } from "@/stores/reader-store"
import type { ReaderAnnotation, ReaderNote } from "@/stores/reader-store"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { TabBar } from "@/components/ui/TabBar"
import { getCategory, CATEGORIES } from "@/lib/paper-categories"
import {
  categoryExtraFieldValue,
  extraFieldValue,
  publicationPagesValue,
  preserveEnrichmentFields,
  toEditableExtraFields,
  updateCategoryExtraField,
} from "@/lib/paper-metadata"
import { MarkdownContent } from "@/components/reader/MarkdownContent"
import { ChatPanel } from "@/components/chat/ChatPanel"
import { CommentThread } from "@/components/annotations/CommentThread"
import { AnnotationDialog } from "@/components/reader/AnnotationDialog"
import { deleteAnnotation, updateAnnotation } from "@/lib/api/annotations"
import { deleteNote, updateNote } from "@/lib/api/notes"
import { applyPaperMetadata, resolvePaperMetadata } from "@/lib/api/papers"
import { useToastStore } from "@/stores/toast-store"
import type { PaperDetailDto, Category, MetadataFieldCandidateDto, MetadataResolutionDto } from "@/lib/api/types"

type PanelTab = "metadata" | "annotations" | "notes" | "aiChat"

interface RightPanelProps {
  paper?: PaperDetailDto | null
  onConfigureProvider?: () => void
}

export function RightPanel({ paper, onConfigureProvider }: RightPanelProps) {
  const t = useTranslations("panel")
  const [activeTab, setActiveTab] = useState<PanelTab>("metadata")
  const [collapsed, setCollapsed] = useState(false)

  const {
    updateAnnotation: storeUpdateAnnotation,
    removeAnnotation,
    updateNote: storeUpdateNote,
    removeNote,
    pendingPaperQuestion,
  } = useReaderStore()
  const addToast = useToastStore((s) => s.addToast)
  const pendingQuestionId = pendingPaperQuestion?.requestId

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editDialogMode, setEditDialogMode] = useState<"annotation" | "note">("annotation")
  const [editItem, setEditItem] = useState<ReaderAnnotation | ReaderNote | null>(null)

  useEffect(() => {
    if (pendingQuestionId) setActiveTab("aiChat")
  }, [pendingQuestionId])

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

      <div className={cn(
        "flex-1 min-h-0",
        activeTab === "aiChat" ? "overflow-hidden" : "overflow-auto p-4",
      )}>
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
        {activeTab === "aiChat" && <ChatPanel onConfigureProvider={onConfigureProvider} />}
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

function FieldRow({ label, children }: { label: string; children?: React.ReactNode }) {
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
  const tc = useTranslations("common")

  const updatePaper = usePaperStore((s) => s.updatePaper)
  const replacePaper = usePaperStore((s) => s.replacePaper)
  const addToast = useToastStore((s) => s.addToast)

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
  const [metadataResolution, setMetadataResolution] = useState<MetadataResolutionDto | null>(null)
  const [metadataSelected, setMetadataSelected] = useState<Record<string, boolean>>({})
  const [metadataIdentifier, setMetadataIdentifier] = useState("")
  const [metadataLoading, setMetadataLoading] = useState(false)
  const [metadataApplying, setMetadataApplying] = useState(false)
  const [metadataError, setMetadataError] = useState<string | null>(null)

  // Sync form state when paper changes or editing toggles
  useEffect(() => {
    if (paper) {
      setTitle(paper.title ?? "")
      setAuthors(paper.authors ?? "")
      setParticipants(paper.participants ?? "")
      setAbstractText(paper.abstractText ?? "")
      setDoi(paper.doi ?? "")
      setYear(paper.year?.toString() ?? "")
      setJournal(paper.journal ?? extraFieldValue(paper.extraFields, "journalName") ?? "")
      setCategory(paper.category)
      setExtraFields(toEditableExtraFields(paper.extraFields))
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
    setExtraFields((prev) => updateCategoryExtraField(prev, key, value))
  }, [])

  const handleCategoryChange = useCallback((newCat: Category) => {
    setCategory(newCat)
    setExtraFields((current) => preserveEnrichmentFields(current))
  }, [])

  const handleResolveMetadata = useCallback(async () => {
    if (!paper) return
    setMetadataLoading(true)
    setMetadataError(null)
    try {
      const resolution = await resolvePaperMetadata(paper.id, metadataIdentifier)
      setMetadataResolution(resolution)
      setMetadataSelected(Object.fromEntries(
        resolution.fields.map((field) => [field.field, field.selectedByDefault]),
      ))
    } catch (error) {
      setMetadataError((error as Error).message || t("metadataLookupFailed"))
    } finally {
      setMetadataLoading(false)
    }
  }, [paper, metadataIdentifier, t])

  const handleApplyMetadata = useCallback(async () => {
    if (!paper || !metadataResolution) return
    setMetadataApplying(true)
    setMetadataError(null)
    try {
      const fields = Object.entries(metadataSelected).filter(([, selected]) => selected).map(([field]) => field)
      const result = await applyPaperMetadata(paper.id, metadataResolution.id, fields)
      replacePaper(result.paper)
      setMetadataResolution(null)
      setMetadataSelected({})
      addToast({ message: t("metadataApplied", { count: result.appliedFields.length }), type: "success" })
    } catch (error) {
      setMetadataError((error as Error).message || t("metadataApplyFailed"))
    } finally {
      setMetadataApplying(false)
    }
  }, [paper, metadataResolution, metadataSelected, replacePaper, addToast, t])

  if (!paper) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-[var(--text-tertiary)]">{t("selectPaper")}</p>
      </div>
    )
  }

  const catDef = getCategory(paper.category)
  const hasExternalMetadata = [
    "arxivId",
    "arxivVersion",
    "arxivCategories",
    "arxivPrimaryCategory",
    "arxivSubmittedAt",
    "arxivUpdatedAt",
    "arxivComment",
    "repositoryDoi",
    "dblpKey",
    "licenseUrl",
  ].some((key) => Boolean(extraFieldValue(paper.extraFields, key)))

  return (
    <div className="space-y-3 pb-6">
      {/* Edit / Save toolbar */}
      <div className="flex items-center gap-2">
        {editing && (
          <span className="text-[11px] text-[var(--text-tertiary)] flex-1">
            {t("editing")}
          </span>
        )}
        {editing ? (
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="secondary" onClick={handleCancel} disabled={saving}>
              {tc("cancel")}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Save className="size-3" />
              )}
              <span className="ml-1">{tc("save")}</span>
            </Button>
          </div>
        ) : (
          <div className="flex w-full min-w-0 items-center gap-2">
            <Input
              value={metadataIdentifier}
              onChange={(event) => setMetadataIdentifier(event.target.value)}
              placeholder={t("identifierPlaceholder")}
              aria-label={t("identifierPlaceholder")}
              className="h-7 min-w-0 flex-1 text-[10px]"
            />
            <button
              onClick={handleResolveMetadata}
              disabled={metadataLoading}
              title={t("enrichMetadata")}
              className="inline-flex items-center gap-1 text-[11.5px] text-[var(--text-tertiary)] hover:text-[var(--accent)] disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={cn("size-3", metadataLoading && "animate-spin")} />
              {t("enrichMetadata")}
            </button>
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 text-[11.5px] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
            >
              <Pencil className="size-3" />
              {t("edit")}
            </button>
          </div>
        )}
      </div>

      {metadataError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-400/25 bg-red-500/5 px-3 py-2 text-[12px] text-red-500">
          <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
          <span className="flex-1 break-words">{metadataError}</span>
          <button type="button" title={t("dismissMetadataError")} onClick={() => setMetadataError(null)} className="shrink-0 opacity-70 hover:opacity-100">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {metadataResolution && (
        <MetadataPreview
          resolution={metadataResolution}
          selected={metadataSelected}
          applying={metadataApplying}
          onToggle={(field) => setMetadataSelected((current) => ({ ...current, [field]: !current[field] }))}
          onApply={handleApplyMetadata}
          onClose={() => { setMetadataResolution(null); setMetadataSelected({}) }}
          translate={t}
        />
      )}

      {/* Section: Basic Info */}
      <SectionCard title={tp("basicInfo")}>
        <FieldRow label={t("title")}>
          {editing ? (
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          ) : (
            <DisplayValue value={paper.title} />
          )}
        </FieldRow>
        <FieldRow label={t("authors")}>
          {editing ? (
            <Input value={authors} onChange={(e) => setAuthors(e.target.value)} />
          ) : (
            <DisplayValue value={paper.authors} />
          )}
        </FieldRow>
        <FieldRow label={t("participants")}>
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
        <FieldRow label={t("year")}>
          {editing ? (
            <Input value={year} onChange={(e) => setYear(e.target.value)} />
          ) : (
            <DisplayValue value={paper.year} />
          )}
        </FieldRow>
        <FieldRow label={t("journal")}>
          {editing ? (
            <Input value={journal} onChange={(e) => setJournal(e.target.value)} />
          ) : (
            <DisplayValue value={paper.journal ?? extraFieldValue(paper.extraFields, "journalName")} />
          )}
        </FieldRow>
        <FieldRow label={t("doi")}>
          {editing ? (
            <Input value={doi} onChange={(e) => setDoi(e.target.value)} />
          ) : (
            <DisplayValue value={paper.doi} mono />
          )}
        </FieldRow>
        <FieldRow label={t("volume")}>
          <DisplayValue value={extraFieldValue(paper.extraFields, "volume")} />
        </FieldRow>
        <FieldRow label={t("issue")}>
          <DisplayValue value={extraFieldValue(paper.extraFields, "issue")} />
        </FieldRow>
        <FieldRow label={t("publicationPages")}>
          <DisplayValue value={publicationPagesValue(paper.extraFields)} />
        </FieldRow>
        <FieldRow label={t("publisher")}>
          <DisplayValue value={extraFieldValue(paper.extraFields, "publisher")} />
        </FieldRow>
        <FieldRow label={t("publicationType")}>
          <DisplayValue value={extraFieldValue(paper.extraFields, "publicationType")} />
        </FieldRow>
        <FieldRow label={t("publicationDate")}>
          <DisplayValue value={extraFieldValue(paper.extraFields, "publicationDate")} />
        </FieldRow>
        <FieldRow label={t("articleNumber")}>
          <DisplayValue value={extraFieldValue(paper.extraFields, "articleNumber")} />
        </FieldRow>
        <FieldRow label={t("issn")}>
          <DisplayValue value={extraFieldValue(paper.extraFields, "issn")} mono />
        </FieldRow>
        <FieldRow label={t("isbn")}>
          <DisplayValue value={extraFieldValue(paper.extraFields, "isbn")} mono />
        </FieldRow>
      </SectionCard>

      {hasExternalMetadata && (
        <SectionCard title={t("externalMetadata")}>
          <FieldRow label={t("arxivId")}><DisplayValue value={extraFieldValue(paper.extraFields, "arxivId")} mono /></FieldRow>
          <FieldRow label={t("arxivVersion")}><DisplayValue value={extraFieldValue(paper.extraFields, "arxivVersion")} /></FieldRow>
          <FieldRow label={t("arxivPrimaryCategory")}><DisplayValue value={extraFieldValue(paper.extraFields, "arxivPrimaryCategory")} /></FieldRow>
          <FieldRow label={t("arxivCategories")}><DisplayValue value={extraFieldValue(paper.extraFields, "arxivCategories")} /></FieldRow>
          <FieldRow label={t("submittedAt")}><DisplayValue value={extraFieldValue(paper.extraFields, "arxivSubmittedAt")} mono /></FieldRow>
          <FieldRow label={t("lastRevised")}><DisplayValue value={extraFieldValue(paper.extraFields, "arxivUpdatedAt")} mono /></FieldRow>
          <FieldRow label={t("arxivComment")}><DisplayValue value={extraFieldValue(paper.extraFields, "arxivComment")} /></FieldRow>
          <FieldRow label={t("repositoryDoi")}><DisplayValue value={extraFieldValue(paper.extraFields, "repositoryDoi")} mono /></FieldRow>
          <FieldRow label={t("dblpKey")}><DisplayValue value={extraFieldValue(paper.extraFields, "dblpKey")} mono /></FieldRow>
          <FieldRow label={t("licenseUrl")}><DisplayValue value={extraFieldValue(paper.extraFields, "licenseUrl")} mono /></FieldRow>
        </SectionCard>
      )}

      {/* Section: Classification */}
      <SectionCard title={t("category")}>
        <FieldRow label={t("category")}>
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
          <FieldRow key={field.key} label={field.label}>
            {field.type === "textarea" ? (
              <textarea
                rows={3}
                value={categoryExtraFieldValue(extraFields, field.key)}
                onChange={(e) => handleExtraField(field.key, e.target.value)}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-0)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]/40 resize-none"
              />
            ) : field.type === "select" ? (
              <select
                value={categoryExtraFieldValue(extraFields, field.key)}
                onChange={(e) => handleExtraField(field.key, e.target.value)}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-0)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]/40"
              >
                <option value="">--</option>
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : field.type === "date" ? (
              <Input type="date" value={categoryExtraFieldValue(extraFields, field.key)} onChange={(e) => handleExtraField(field.key, e.target.value)} />
            ) : (
              <Input value={categoryExtraFieldValue(extraFields, field.key)} onChange={(e) => handleExtraField(field.key, e.target.value)} />
            )}
          </FieldRow>
        ))}
        {!editing && catDef.fields.map((field) => {
          const val = categoryExtraFieldValue(paper.extraFields, field.key)
          return (
            <FieldRow key={field.key} label={field.label}>
              <DisplayValue value={val || null} />
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
        {paper.parseStatus && paper.parseStatus !== "NOT_APPLICABLE" && (
          <FieldRow label={t("parseStatus")}>
            <DisplayValue
              value={
                paper.parseStatus === "PENDING" ? t("parsePending") :
                  paper.parseStatus === "PROCESSING" ? t("parseProcessing") :
                    paper.parseStatus === "READY" ? t("parseReady") :
                      paper.parseStatus === "FAILED" ? t("parseFailed", { error: paper.parseError ? `: ${paper.parseError}` : "" }) :
                        paper.parseStatus
              }
            />
          </FieldRow>
        )}
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

function MetadataPreview({
  resolution,
  selected,
  applying,
  onToggle,
  onApply,
  onClose,
  translate,
}: {
  resolution: MetadataResolutionDto
  selected: Record<string, boolean>
  applying: boolean
  onToggle: (field: string) => void
  onApply: () => void
  onClose: () => void
  translate: (key: string) => string
}) {
  const fields = resolution.fields
  const labelForField = (field: string) => {
    const labels: Record<string, string> = {
      title: translate("title"),
      authors: translate("authors"),
      abstractText: translate("abstract"),
      doi: translate("doi"),
      year: translate("year"),
      journal: translate("journal"),
      "extra.arxivId": translate("arxivId"),
      "extra.arxivVersion": translate("arxivVersion"),
      "extra.arxivCategories": translate("arxivCategories"),
      "extra.arxivPrimaryCategory": translate("arxivPrimaryCategory"),
      "extra.arxivComment": translate("arxivComment"),
      "extra.arxivSubmittedAt": translate("submittedAt"),
      "extra.arxivUpdatedAt": translate("lastRevised"),
      "extra.repositoryDoi": translate("repositoryDoi"),
      "extra.publicationType": translate("publicationType"),
      "extra.publicationDate": translate("publicationDate"),
      "extra.volume": translate("volume"),
      "extra.issue": translate("issue"),
      "extra.publicationPages": translate("publicationPages"),
      "extra.articleNumber": translate("articleNumber"),
      "extra.publisher": translate("publisher"),
      "extra.issn": translate("issn"),
      "extra.isbn": translate("isbn"),
      "extra.licenseUrl": translate("licenseUrl"),
      "extra.dblpKey": translate("dblpKey"),
    }
    return labels[field] || field.replace(/^extra\./, "")
  }

  return (
    <div className="rounded-[10px] border border-[var(--accent)]/25 bg-[var(--accent)]/5 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--accent)]/15">
        <div className="min-w-0">
          <h3 className="text-[12px] font-semibold text-[var(--text-primary)]">{translate("metadataPreview")}</h3>
          <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5 break-all">
            {Object.entries(resolution.identifiers).map(([type, value]) => `${type}: ${value}`).join(" · ") || translate("noExactIdentifier")}
          </div>
        </div>
        <button type="button" title={translate("closeMetadataPreview")} onClick={onClose} className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]">
          <X className="size-3.5" />
        </button>
      </div>
      {resolution.warnings && resolution.warnings.length > 0 && (
        <div className="px-3 py-2 space-y-1 border-b border-[var(--accent)]/15">
          {resolution.warnings.map((warning) => <p key={warning} className="text-[10.5px] leading-relaxed text-[var(--text-secondary)]">{translateWarning(warning, translate)}</p>)}
        </div>
      )}
      <div className="px-3 py-2 space-y-1.5 max-h-72 overflow-y-auto">
        {fields.length === 0 ? (
          <p className="text-[11px] text-[var(--text-tertiary)]">{translate("noMetadataCandidates")}</p>
        ) : fields.map((field) => <MetadataCandidateRow key={field.field} field={field} checked={Boolean(selected[field.field])} onToggle={() => onToggle(field.field)} label={labelForField(field.field)} translate={translate} />)}
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-[var(--accent)]/15">
        <span className="text-[10px] text-[var(--text-tertiary)]">{translate("metadataPreviewHint")}</span>
        <Button size="sm" onClick={onApply} disabled={applying || !Object.values(selected).some(Boolean)}>
          {applying ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
          <span className="ml-1">{translate("applyMetadata")}</span>
        </Button>
      </div>
    </div>
  )
}

function MetadataCandidateRow({
  field,
  checked,
  onToggle,
  label,
  translate,
}: {
  field: MetadataFieldCandidateDto
  checked: boolean
  onToggle: () => void
  label: string
  translate: (key: string, values?: Record<string, string | number>) => string
}) {
  return (
    <label className={cn("flex items-start gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors", checked ? "bg-[var(--surface-0)]" : "hover:bg-[var(--surface-0)]/70")}>
      <input type="checkbox" checked={checked} onChange={onToggle} className="mt-0.5 accent-[var(--accent)]" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-secondary)]">
          <span>{label}</span>
          {field.conflict && <span className="text-[9px] text-amber-600">{translate("conflict")}</span>}
          {field.source && <span className="text-[9px] text-[var(--text-tertiary)]">{field.source} · {field.matchMethod || "EXACT_ID"} · {Math.round(field.confidence * 100)}%</span>}
        </span>
        <span className="block mt-0.5 text-[11px] leading-relaxed break-words text-[var(--text-primary)]">{field.suggestedValue || "--"}</span>
        {field.currentValue && field.conflict && <span className="block mt-0.5 text-[10px] leading-relaxed break-words text-[var(--text-tertiary)]">{translate("currentValue", { value: field.currentValue })}</span>}
        {field.recordUrl && (
          <a href={field.recordUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-0.5 text-[9.5px] text-[var(--accent)] hover:underline" onClick={(event) => event.stopPropagation()}>
            <ExternalLink className="size-2.5" /> {translate("source")}
          </a>
        )}
      </span>
    </label>
  )
}

function translateWarning(warning: string, translate: (key: string) => string): string {
  const knownWarnings: Record<string, string> = {
    ARXIV_LOOKUP_FAILED: "warning.ARXIV_LOOKUP_FAILED",
    REPOSITORY_DOI_UNVERIFIED: "warning.REPOSITORY_DOI_UNVERIFIED",
    FORMAL_PUBLICATION_CANDIDATE: "warning.FORMAL_PUBLICATION_CANDIDATE",
    DOI_LOOKUP_FAILED: "warning.DOI_LOOKUP_FAILED",
    DBLP_PUBLICATION_CANDIDATE: "warning.DBLP_PUBLICATION_CANDIDATE",
    IDENTIFIER_METADATA_MISMATCH: "warning.IDENTIFIER_METADATA_MISMATCH",
    NO_EXACT_IDENTIFIER: "warning.NO_EXACT_IDENTIFIER",
    NO_METADATA_CANDIDATES: "warning.NO_METADATA_CANDIDATES",
  }
  return knownWarnings[warning] ? translate(knownWarnings[warning]) : warning
}

function AnnotationList({
  onEdit, onDelete,
}: {
  onEdit: (a: ReaderAnnotation) => void
  onDelete: (id: number) => void
}) {
  const { annotations, loadAnnotations, loadingAnnotations, setNavigationTarget } = useReaderStore()
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
        <div
          key={a.id}
          onClick={() => setNavigationTarget({ pageNumber: a.pageNumber, position: a.position, timestamp: Date.now() })}
          className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] overflow-hidden relative group cursor-pointer hover:border-[var(--accent)]/30 transition-colors"
        >
          {/* Action buttons — top-right */}
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
            onClick={(e) => e.stopPropagation()}
          >
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

function NoteList({
  onEdit, onDelete,
}: {
  onEdit: (n: ReaderNote) => void
  onDelete: (id: number) => void
}) {
  const { notes, loadNotes, loadingNotes, setNavigationTarget } = useReaderStore()
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
        <div
          key={n.id}
          onClick={() => setNavigationTarget({ pageNumber: n.pageNumber, position: n.position, timestamp: Date.now() })}
          className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] overflow-hidden relative group cursor-pointer hover:border-[var(--accent)]/30 transition-colors"
        >
          {/* Action buttons — top-right */}
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
            onClick={(e) => e.stopPropagation()}
          >
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
