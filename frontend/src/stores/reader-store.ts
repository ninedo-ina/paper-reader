import { create } from "zustand"

export interface ReaderAnnotation {
  id: number
  paperId: number
  pageNumber: number
  text: string        // selected/anchored text
  content: string     // Markdown content
  images: string[]    // base64 or URL
  position: { x: number; y: number; width: number; height: number }
  createdAt: string
}

export interface ReaderNote {
  id: number
  paperId: number
  pageNumber: number
  text: string
  title?: string
  content: string
  images: string[]
  position: { x: number; y: number; width: number; height: number }
  createdAt: string
}

interface ReaderState {
  annotations: ReaderAnnotation[]
  notes: ReaderNote[]
  aiMode: "context" | "explain" | "translate" | null
  selectedText: string

  setAnnotations: (annotations: ReaderAnnotation[]) => void
  addAnnotation: (a: ReaderAnnotation) => void
  removeAnnotation: (id: number) => void

  setNotes: (notes: ReaderNote[]) => void
  addNote: (n: ReaderNote) => void
  removeNote: (id: number) => void

  setAiMode: (mode: ReaderState["aiMode"]) => void
  setSelectedText: (text: string) => void
}

export const useReaderStore = create<ReaderState>((set) => ({
  annotations: [],
  notes: [],
  aiMode: null,
  selectedText: "",

  setAnnotations: (annotations) => set({ annotations }),
  addAnnotation: (a) => set((s) => ({ annotations: [...s.annotations, a] })),
  removeAnnotation: (id) => set((s) => ({ annotations: s.annotations.filter((a) => a.id !== id) })),

  setNotes: (notes) => set({ notes }),
  addNote: (n) => set((s) => ({ notes: [...s.notes, n] })),
  removeNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

  setAiMode: (aiMode) => set({ aiMode }),
  setSelectedText: (selectedText) => set({ selectedText }),
}))
