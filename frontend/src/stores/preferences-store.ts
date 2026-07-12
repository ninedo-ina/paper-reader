import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface AiProvider {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  models: string[]
  active: boolean
}

interface UiSettings {
  language: string
  fontSize: string
}

interface PreferencesState {
  ui: UiSettings
  providers: AiProvider[]
  activeProviderId: string | null

  setUi: (ui: Partial<UiSettings>) => void
  addProvider: (p: Omit<AiProvider, "id" | "active">) => void
  updateProvider: (id: string, p: Partial<AiProvider>) => void
  removeProvider: (id: string) => void
  setActiveProvider: (id: string) => void
  getActiveProvider: () => AiProvider | null
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      ui: {
        language: "zh",
        fontSize: "medium",
      },
      providers: [],
      activeProviderId: null,

      setUi: (ui) => set((s) => ({ ui: { ...s.ui, ...ui } })),

      addProvider: (p) =>
        set((s) => ({
          providers: [
            ...s.providers,
            { ...p, id: crypto.randomUUID(), active: false },
          ],
        })),

      updateProvider: (id, p) =>
        set((s) => ({
          providers: s.providers.map((prov) =>
            prov.id === id ? { ...prov, ...p } : prov,
          ),
        })),

      removeProvider: (id) =>
        set((s) => {
          const providers = s.providers.filter((p) => p.id !== id)
          return {
            providers,
            activeProviderId:
              s.activeProviderId === id ? null : s.activeProviderId,
          }
        }),

      setActiveProvider: (id) =>
        set((s) => ({
          activeProviderId: id,
          providers: s.providers.map((p) => ({
            ...p,
            active: p.id === id,
          })),
        })),

      getActiveProvider: () => {
        const state = get()
        return state.providers.find((p) => p.id === state.activeProviderId) ?? null
      },
    }),
    {
      name: "pr-preferences",
      partialize: (state) => ({
        ui: state.ui,
        providers: state.providers,
        activeProviderId: state.activeProviderId,
      }),
    },
  ),
)
