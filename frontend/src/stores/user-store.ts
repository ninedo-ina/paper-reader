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

/**
 * 同一时刻只允许一个 /auth/me 在飞。登录成功和 SessionLoader 都会主动拉一次
 * 资料，去重之后两边不会各发一个请求。
 */
let inflight: Promise<void> | null = null

export const useUserStore = create<UserState>((set) => ({
  profile: null,
  isLoading: false,

  loadProfile: () => {
    if (inflight) return inflight
    set({ isLoading: true })
    inflight = authApi
      .getUserProfile()
      .then((profile) => set({ profile, isLoading: false }))
      .catch(() => set({ isLoading: false }))
      .finally(() => { inflight = null })
    return inflight
  },

  clearProfile: () => set({ profile: null, isLoading: false }),
}))
