// =============================================================================
// 用户信息状态管理
// =============================================================================

import { create } from "zustand"
import * as authApi from "@/lib/api/auth"
import type { UserProfile } from "@/lib/api/types"

interface UserState {
  profile: UserProfile | null
  isLoading: boolean

  loadProfile: () => Promise<void>
  clearProfile: () => void
}

export const useUserStore = create<UserState>((set) => ({
  profile: null,
  isLoading: false,

  loadProfile: async () => {
    set({ isLoading: true })
    try {
      const profile = await authApi.getUserProfile()
      set({ profile, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  clearProfile: () => set({ profile: null, isLoading: false }),
}))
