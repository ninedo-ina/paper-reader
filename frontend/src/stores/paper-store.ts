// =============================================================================
// 论文状态管理
// =============================================================================

import { create } from "zustand"
import * as papersApi from "@/lib/api/papers"
import type { PaperListDto, PaperDetailDto, CreatePaperRequest, UpdatePaperRequest } from "@/lib/api/types"

export type TabKey = "create" | "import"

interface PaperState {
  // 论文列表
  papers: PaperListDto[]
  total: number
  page: number
  isListLoading: boolean

  // TabBar 状态
  activeTab: TabKey
  sourceTypeFilter: string | undefined

  // 当前论文
  currentPaper: PaperDetailDto | null
  isDetailLoading: boolean

  // 错误
  error: string | null

  // 上传后自动展示信息面板
  showInfoPanel: boolean

  // 计算属性（通过 getter 风格访问）
  createCount: number
  importCount: number

  // 操作
  loadPapers: (page?: number, sourceType?: string) => Promise<void>
  loadPaper: (id: number) => Promise<void>
  setActiveTab: (tab: TabKey) => void
  uploadPdf: (file: File) => Promise<PaperDetailDto>
  uploadFromUrl: (url: string, title?: string) => Promise<PaperDetailDto>
  createPaper: (data: CreatePaperRequest) => Promise<PaperDetailDto>
  updatePaper: (id: number, data: UpdatePaperRequest) => Promise<void>
  toggleFavorite: (id: number) => Promise<void>
  deletePaper: (id: number) => Promise<void>
  clearCurrentPaper: () => void
  consumeShowInfoPanel: () => boolean
  clearError: () => void
}

export const usePaperStore = create<PaperState>((set, get) => ({
  papers: [],
  total: 0,
  page: 0,
  isListLoading: false,
  activeTab: "import",
  sourceTypeFilter: undefined,
  currentPaper: null,
  isDetailLoading: false,
  error: null,
  showInfoPanel: false,

  get createCount(): number {
    return get().papers.filter((p) => p.sourceType === "MANUAL").length
  },
  get importCount(): number {
    return get().papers.filter((p) => p.sourceType === "UPLOAD" || p.sourceType === "URL").length
  },

  loadPapers: async (page = 0, sourceType) => {
    set({ isListLoading: true, error: null })
    try {
      const res = await papersApi.listPapers(page, 20, sourceType)
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

  setActiveTab: (tab) => {
    set({ activeTab: tab, sourceTypeFilter: tab })
    get().loadPapers(0, tab)
  },

  uploadPdf: async (file) => {
    set({ error: null })
    const paper = await papersApi.uploadPdf(file)
    const list = await papersApi.listPapers(0, 20, "import")
    set({
      papers: list.items,
      total: list.total,
      page: list.page,
      currentPaper: paper,
      activeTab: "import",
      sourceTypeFilter: "import",
      showInfoPanel: true,
    })
    return paper
  },

  uploadFromUrl: async (url, title) => {
    set({ error: null })
    const paper = await papersApi.uploadFromUrl({ url, title })
    const list = await papersApi.listPapers(0, 20, "import")
    set({
      papers: list.items,
      total: list.total,
      page: list.page,
      currentPaper: paper,
      activeTab: "import",
      sourceTypeFilter: "import",
      showInfoPanel: true,
    })
    return paper
  },

  createPaper: async (data) => {
    set({ error: null })
    const paper = await papersApi.createPaper(data)
    const list = await papersApi.listPapers(0, 20, "create")
    set({
      papers: list.items,
      total: list.total,
      page: list.page,
      currentPaper: paper,
      activeTab: "create",
      sourceTypeFilter: "create",
    })
    return paper
  },

  updatePaper: async (id, data) => {
    set({ error: null })
    const updated = await papersApi.updatePaper(id, data)
    set((s) => ({
      papers: s.papers.map((p) => (p.id === id ? { ...p, ...updated } as unknown as PaperListDto : p)),
      currentPaper: updated,
    }))
  },

  toggleFavorite: async (id) => {
    set({ error: null })
    const paper = get().papers.find((p) => p.id === id)
    if (!paper) return
    const updated = await papersApi.toggleFavorite(id, !paper.favorite)
    set((s) => ({
      papers: s.papers.map((p) => (p.id === id ? { ...p, ...updated } as unknown as PaperListDto : p)),
      currentPaper: s.currentPaper?.id === id ? updated : s.currentPaper,
    }))
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
  consumeShowInfoPanel: () => {
    const { showInfoPanel } = get()
    if (showInfoPanel) {
      set({ showInfoPanel: false })
      return true
    }
    return false
  },
  clearError: () => set({ error: null }),
}))
