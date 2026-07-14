// =============================================================================
// 论文状态管理
// =============================================================================

import { create } from "zustand"
import * as papersApi from "@/lib/api/papers"
import type { PaperListDto, PaperDetailDto, CreatePaperRequest, UpdatePaperRequest } from "@/lib/api/types"

export type TabKey = "create" | "import"
export type FavoriteTabKey = "all" | "create" | "import"

interface PaperState {
  // 论文列表
  papers: PaperListDto[]
  total: number
  page: number
  isListLoading: boolean

  // TabBar 状态
  activeTab: TabKey
  sourceTypeFilter: string | undefined

  // 收藏面板
  activeFavoriteTab: FavoriteTabKey
  favoriteCount: number
  favoriteSourceType: string | undefined

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
  loadPapers: (page?: number, sourceType?: string, favorite?: boolean) => Promise<void>
  loadPaper: (id: number) => Promise<void>
  loadCounts: () => Promise<void>
  setActiveTab: (tab: TabKey) => void
  setFavoriteTab: (tab: FavoriteTabKey) => void
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
  activeFavoriteTab: "all",
  favoriteCount: 0,
  favoriteSourceType: undefined,
  currentPaper: null,
  isDetailLoading: false,
  error: null,
  showInfoPanel: false,

  createCount: 0,
  importCount: 0,

  loadCounts: async () => {
    try {
      const [createRes, importRes, favRes] = await Promise.all([
        papersApi.listPapers(0, 1, "create"),
        papersApi.listPapers(0, 1, "import"),
        papersApi.countFavorites(),
      ])
      set({ createCount: createRes.total, importCount: importRes.total, favoriteCount: favRes.total })
    } catch {
      // 静默失败，保留旧值
    }
  },

  loadPapers: async (page = 0, sourceType, favorite = false) => {
    set({ isListLoading: true, error: null })
    try {
      const res = await papersApi.listPapers(page, 20, sourceType, favorite || undefined)
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
    const sourceType = tab === "create" ? "create" : "import"
    set({ activeTab: tab, sourceTypeFilter: sourceType, page: 0 })
    get().loadPapers(0, sourceType)
  },

  setFavoriteTab: (tab) => {
    const sourceType = tab === "all" ? undefined : tab === "create" ? "create" : "import"
    set({ activeFavoriteTab: tab, favoriteSourceType: sourceType, page: 0 })
    get().loadPapers(0, sourceType, true)
  },

  uploadPdf: async (file) => {
    set({ error: null })
    const paper = await papersApi.uploadPdf(file)
    const list = await papersApi.listPapers(0, 20)
    set({
      papers: list.items,
      total: list.total,
      page: list.page,
      currentPaper: paper,
      activeTab: "import",
      sourceTypeFilter: "import",
      showInfoPanel: true,
    })
    get().loadCounts().catch(() => {})
    return paper
  },

  uploadFromUrl: async (url, title) => {
    set({ error: null })
    const paper = await papersApi.uploadFromUrl({ url, title })
    const list = await papersApi.listPapers(0, 20)
    set({
      papers: list.items,
      total: list.total,
      page: list.page,
      currentPaper: paper,
      activeTab: "import",
      sourceTypeFilter: "import",
      showInfoPanel: true,
    })
    get().loadCounts().catch(() => {})
    return paper
  },

  createPaper: async (data) => {
    set({ error: null })
    const paper = await papersApi.createPaper(data)
    const list = await papersApi.listPapers(0, 20)
    set({
      papers: list.items,
      total: list.total,
      page: list.page,
      currentPaper: paper,
      activeTab: "create",
      sourceTypeFilter: "create",
    })
    get().loadCounts().catch(() => {})
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
    get().loadCounts().catch(() => {})
  },

  deletePaper: async (id) => {
    set({ error: null })
    await papersApi.deletePaper(id)
    set((s) => ({
      papers: s.papers.filter((p) => p.id !== id),
      currentPaper: s.currentPaper?.id === id ? null : s.currentPaper,
    }))
    get().loadCounts().catch(() => {})
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
