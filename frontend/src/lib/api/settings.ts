import { get, put } from "./client"
import type { UserSettingsDto, UpdateUserSettingsRequest } from "./types"

export function getSettings(): Promise<UserSettingsDto> {
  return get<UserSettingsDto>("/settings")
}

export function updateSettings(data: UpdateUserSettingsRequest): Promise<UserSettingsDto> {
  return put<UserSettingsDto>("/settings", data)
}
