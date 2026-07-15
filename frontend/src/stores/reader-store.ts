import { create } from "zustand"
import { listAnnotations as fetchAnnotations } from "@/lib/api/annotations"
import { listNotesByPaper } from "@/lib/api/notes"
import type { AnnotationDto, NoteDto } from "@/lib/api/types"

export interface ReaderAnnotation {
  id: number
  paperId: number
  pageNumber: number
  quotedText: string
  content: string
  images: string[]
  position: { x: number; y: number; width: number; height: number }
  startOffset?: number
  endOffset?: number
  commentCount: number
  createdAt: string
}

export interface ReaderNote {
  id: number
  paperId: number
  pageNumber: number
  quotedText: string
  title?: string
  content: string
  images: string[]
  position: { x: number; y: number; width: number; height: number }
  startOffset?: number
  endOffset?: number
  createdAt: string
}

interface ReaderState {
  annotations: ReaderAnnotation[]
  notes: ReaderNote[]
  aiMode: "context" | "explain" | "translate" | null
  selectedText: string
  loadingAnnotations: boolean
  loadingNotes: boolean

  setAnnotations: (annotations: ReaderAnnotation[]) => void
  addAnnotation: (a: ReaderAnnotation) => void
  removeAnnotation: (id: number) => void

  setNotes: (notes: ReaderNote[]) => void
  addNote: (n: ReaderNote) => void
  removeNote: (id: number) => void

  loadAnnotations: (paperId: number) => Promise<void>
  loadNotes: (paperId: number) => Promise<void>

  setAiMode: (mode: ReaderState["aiMode"]) => void
  setSelectedText: (text: string) => void
}

export const useReaderStore = create<ReaderState>((set) => ({
  annotations: [],
  notes: [],
  aiMode: null,
  selectedText: "",
  loadingAnnotations: false,
  loadingNotes: false,

  setAnnotations: (annotations) => set({ annotations }),
  addAnnotation: (a) => set((s) => ({ annotations: [...s.annotations, a] })),
  removeAnnotation: (id) => set((s) => ({ annotations: s.annotations.filter((a) => a.id !== id) })),

  setNotes: (notes) => set({ notes }),
  addNote: (n) => set((s) => ({ notes: [...s.notes, n] })),
  removeNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

  loadAnnotations: async (paperId) => {
    set({ loadingAnnotations: true })
    try {
      const result = await fetchAnnotations(paperId)
      const items = "items" in result ? (result.items as AnnotationDto[]) : (result as unknown as AnnotationDto[])
      const list = Array.isArray(items) ? items : []
      set({
        annotations: list.map((a) => ({
          id: a.id,
          paperId: a.paperId,
          pageNumber: a.pageNumber,
          quotedText: a.quotedText || a.text || "",
          content: a.comment || "",
          images: a.images || [],
          position: (a.position as unknown as ReaderAnnotation["position"]) || { x: 0, y: 0, width: 0, height: 0 },
          startOffset: a.startOffset,
          endOffset: a.endOffset,
          commentCount: a.commentCount || 0,
          createdAt: a.createdAt,
        })),
      })
    } catch {
      // keep existing annotations on error
    } finally {
      set({ loadingAnnotations: false })
    }
  },

  loadNotes: async (paperId) => {
    set({ loadingNotes: true })
    try {
      const result = await listNotesByPaper(paperId)
      const items = Array.isArray(result) ? (result as NoteDto[]) : []
      set({
        notes: items.map((n) => ({
          id: n.id,
          paperId: n.paperId,
          pageNumber: n.pageNumber || 0,
          quotedText: n.quotedText || "",
          title: n.title,
          content: n.content,
          images: n.images || [],
          position: (n as unknown as { position?: ReaderNote["position"] }).position || { x: 0, y: 0, width: 0, height: 0 },
          startOffset: n.startOffset,
          endOffset: n.endOffset,
          createdAt: n.createdAt,
        })),
      })
    } catch {
      // keep existing notes on error
    } finally {
      set({ loadingNotes: false })
    }
  },

  setAiMode: (aiMode) => set({ aiMode }),
  setSelectedText: (selectedText) => set({ selectedText }),
}))
