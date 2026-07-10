import { create } from "zustand"
import * as storageApi from "@/lib/api/storage"
import type { StorageConfigDto, CreateStorageConfigRequest, UpdateStorageConfigRequest } from "@/lib/api/types"

interface StorageState {
  configs: StorageConfigDto[]
  isLoading: boolean
  error: string | null

  loadConfigs: () => Promise<void>
  createConfig: (data: CreateStorageConfigRequest) => Promise<StorageConfigDto>
  updateConfig: (id: number, data: UpdateStorageConfigRequest) => Promise<StorageConfigDto>
  deleteConfig: (id: number) => Promise<void>
  clearError: () => void
}

export const useStorageStore = create<StorageState>((set) => ({
  configs: [],
  isLoading: false,
  error: null,

  loadConfigs: async () => {
    set({ isLoading: true, error: null })
    try {
      const configs = await storageApi.listConfigs()
      set({ configs, isLoading: false })
    } catch (e) {
      set({ isLoading: false, error: (e as Error).message })
    }
  },

  createConfig: async (data) => {
    set({ error: null })
    const config = await storageApi.createConfig(data)
    set((s) => ({ configs: [config, ...s.configs] }))
    return config
  },

  updateConfig: async (id, data) => {
    set({ error: null })
    const config = await storageApi.updateConfig(id, data)
    set((s) => ({ configs: s.configs.map((c) => (c.id === id ? config : c)) }))
    return config
  },

  deleteConfig: async (id) => {
    set({ error: null })
    await storageApi.deleteConfig(id)
    set((s) => ({ configs: s.configs.filter((c) => c.id !== id) }))
  },

  clearError: () => set({ error: null }),
}))
