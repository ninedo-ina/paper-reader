// =============================================================================
// 论文状态管理
// =============================================================================

import { create } from "zustand"
import * as papersApi from "@/lib/api/papers"
import type { PaperListDto, PaperDetailDto, CreatePaperRequest } from "@/lib/api/types"

interface PaperState {
  // 论文列表
  papers: PaperListDto[]
  total: number
  page: number
  isListLoading: boolean

  // 当前论文
  currentPaper: PaperDetailDto | null
  isDetailLoading: boolean

  // 错误
  error: string | null

  // 操作
  loadPapers: (page?: number) => Promise<void>
  loadPaper: (id: number) => Promise<void>
  uploadPdf: (file: File) => Promise<PaperDetailDto>
  uploadFromUrl: (url: string, title?: string) => Promise<PaperDetailDto>
  createPaper: (data: CreatePaperRequest) => Promise<PaperDetailDto>
  deletePaper: (id: number) => Promise<void>
  clearCurrentPaper: () => void
  clearError: () => void
}

export const usePaperStore = create<PaperState>((set) => ({
  papers: [],
  total: 0,
  page: 1,
  isListLoading: false,
  currentPaper: null,
  isDetailLoading: false,
  error: null,

  loadPapers: async (page = 1) => {
    set({ isListLoading: true, error: null })
    try {
      const res = await papersApi.listPapers(page)
      set({ papers: res.items, total: res.total, page: res.page, isListLoading: false })
    } catch (e) {
      set({ isListLoading: false, error: (e as Error).message })
    }
  },

  loadPaper: async (id) => {
    set({ isDetailLoading: true, error: null })
    try {
      const paper = await papersApi.getPaper(id)
      set({ currentPaper: paper, isDetailLoading: false })
    } catch (e) {
      set({ isDetailLoading: false, error: (e as Error).message })
    }
  },

  uploadPdf: async (file) => {
    set({ error: null })
    const paper = await papersApi.uploadPdf(file)
    set((s) => ({ papers: [paper as unknown as PaperListDto, ...s.papers], currentPaper: paper }))
    return paper
  },

  uploadFromUrl: async (url, title) => {
    set({ error: null })
    const paper = await papersApi.uploadFromUrl({ url, title })
    set((s) => ({ papers: [paper as unknown as PaperListDto, ...s.papers], currentPaper: paper }))
    return paper
  },

  createPaper: async (data) => {
    set({ error: null })
    const paper = await papersApi.createPaper(data)
    const list = await papersApi.listPapers(1)
    set({ papers: list.items, total: list.total, page: list.page, currentPaper: paper })
    return paper
  },

  deletePaper: async (id) => {
    set({ error: null })
    await papersApi.deletePaper(id)
    set((s) => ({
      papers: s.papers.filter((p) => p.id !== id),
      currentPaper: s.currentPaper?.id === id ? null : s.currentPaper,
    }))
  },

  clearCurrentPaper: () => set({ currentPaper: null }),
  clearError: () => set({ error: null }),
}))
