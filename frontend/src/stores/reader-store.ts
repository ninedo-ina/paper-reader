import { create } from "zustand"
import { listAnnotations as fetchAnnotations, listAllAnnotations } from "@/lib/api/annotations"
import { listNotesByPaper, listNotes } from "@/lib/api/notes"
import type { AnnotationDto, NoteDto } from "@/lib/api/types"

export interface PositionRect {
  x: number
  y: number
  width: number
  height: number
}

export interface ReaderAnnotation {
  id: number
  paperId: number
  pageNumber: number
  quotedText: string
  content: string
  images: string[]
  position: PositionRect
  positions?: PositionRect[]
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
  position: PositionRect
  positions?: PositionRect[]
  startOffset?: number
  endOffset?: number
  createdAt: string
}

export interface NavigationTarget {
  pageNumber: number
  position?: PositionRect
  timestamp: number
}

interface ReaderState {
  annotations: ReaderAnnotation[]
  notes: ReaderNote[]
  allAnnotations: ReaderAnnotation[]
  allNotes: ReaderNote[]
  aiMode: "context" | "explain" | "translate" | null
  selectedText: string
  loadingAnnotations: boolean
  loadingNotes: boolean
  loadingAllAnnotations: boolean
  loadingAllNotes: boolean
  navigationTarget: NavigationTarget | null

  setAnnotations: (annotations: ReaderAnnotation[]) => void
  addAnnotation: (a: ReaderAnnotation) => void
  removeAnnotation: (id: number) => void
  updateAnnotation: (id: number, data: Partial<ReaderAnnotation>) => void

  setNotes: (notes: ReaderNote[]) => void
  addNote: (n: ReaderNote) => void
  removeNote: (id: number) => void
  updateNote: (id: number, data: Partial<ReaderNote>) => void

  loadAnnotations: (paperId: number) => Promise<void>
  loadNotes: (paperId: number) => Promise<void>
  loadAllAnnotations: () => Promise<void>
  loadAllNotes: () => Promise<void>

  setAiMode: (mode: ReaderState["aiMode"]) => void
  setSelectedText: (text: string) => void
  setNavigationTarget: (target: NavigationTarget | null) => void
}

function mapAnnotation(a: AnnotationDto): ReaderAnnotation {
  const pos = (a.position as unknown as Record<string, unknown>) || {}
  return {
    id: a.id,
    paperId: a.paperId,
    pageNumber: a.pageNumber,
    quotedText: a.quotedText || a.text || "",
    content: a.comment || "",
    images: a.images || [],
    position: { x: Number(pos.x ?? 0), y: Number(pos.y ?? 0), width: Number(pos.width ?? 0), height: Number(pos.height ?? 0) },
    positions: pos.positions as PositionRect[] | undefined,
    startOffset: a.startOffset,
    endOffset: a.endOffset,
    commentCount: a.commentCount || 0,
    createdAt: a.createdAt,
  }
}

function mapNote(n: NoteDto): ReaderNote {
  const pos = (n as unknown as Record<string, unknown>).position as Record<string, unknown> | undefined
  return {
    id: n.id,
    paperId: n.paperId,
    pageNumber: n.pageNumber || 0,
    quotedText: n.quotedText || "",
    title: n.title,
    content: n.content,
    images: n.images || [],
    position: pos ? { x: Number(pos.x ?? 0), y: Number(pos.y ?? 0), width: Number(pos.width ?? 0), height: Number(pos.height ?? 0) } : { x: 0, y: 0, width: 0, height: 0 },
    positions: pos?.positions as PositionRect[] | undefined,
    startOffset: n.startOffset,
    endOffset: n.endOffset,
    createdAt: n.createdAt,
  }
}

export const useReaderStore = create<ReaderState>((set) => ({
  annotations: [],
  notes: [],
  allAnnotations: [],
  allNotes: [],
  aiMode: null,
  selectedText: "",
  loadingAnnotations: false,
  loadingNotes: false,
  loadingAllAnnotations: false,
  loadingAllNotes: false,
  navigationTarget: null,

  setAnnotations: (annotations) => set({ annotations }),
  addAnnotation: (a) => set((s) => ({ annotations: [...s.annotations, a] })),
  removeAnnotation: (id) => set((s) => ({ annotations: s.annotations.filter((a) => a.id !== id) })),
  updateAnnotation: (id, data) => set((s) => ({
    annotations: s.annotations.map((a) => (a.id === id ? { ...a, ...data } : a)),
  })),

  setNotes: (notes) => set({ notes }),
  addNote: (n) => set((s) => ({ notes: [...s.notes, n] })),
  removeNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
  updateNote: (id, data) => set((s) => ({
    notes: s.notes.map((n) => (n.id === id ? { ...n, ...data } : n)),
  })),

  loadAnnotations: async (paperId) => {
    set({ loadingAnnotations: true })
    try {
      const result = await fetchAnnotations(paperId)
      const items = "items" in result ? (result.items as AnnotationDto[]) : (result as unknown as AnnotationDto[])
      const list = Array.isArray(items) ? items : []
      set({ annotations: list.map(mapAnnotation) })
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
      set({ notes: items.map(mapNote) })
    } catch {
      // keep existing notes on error
    } finally {
      set({ loadingNotes: false })
    }
  },

  loadAllAnnotations: async () => {
    set({ loadingAllAnnotations: true })
    try {
      const result = await listAllAnnotations(0, 200)
      const items = result.items || []
      set({ allAnnotations: items.map(mapAnnotation) })
    } catch {
      // keep existing on error
    } finally {
      set({ loadingAllAnnotations: false })
    }
  },

  loadAllNotes: async () => {
    set({ loadingAllNotes: true })
    try {
      const result = await listNotes(0, 200)
      const items = result.items || []
      set({ allNotes: items.map(mapNote) })
    } catch {
      // keep existing on error
    } finally {
      set({ loadingAllNotes: false })
    }
  },

  setAiMode: (aiMode) => set({ aiMode }),
  setSelectedText: (selectedText) => set({ selectedText }),
  setNavigationTarget: (navigationTarget) => set({ navigationTarget }),
}))
