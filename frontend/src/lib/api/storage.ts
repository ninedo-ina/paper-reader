import { get, post, put, del } from "./client"
import type { StorageConfigDto, CreateStorageConfigRequest, UpdateStorageConfigRequest } from "./types"

/** 列出用户的存储配置 */
export function listConfigs(): Promise<StorageConfigDto[]> {
  return get<StorageConfigDto[]>("/storage-configs")
}

/** 创建存储配置 */
export function createConfig(data: CreateStorageConfigRequest): Promise<StorageConfigDto> {
  return post<StorageConfigDto>("/storage-configs", data)
}

/** 更新存储配置 */
export function updateConfig(id: number, data: UpdateStorageConfigRequest): Promise<StorageConfigDto> {
  return put<StorageConfigDto>(`/storage-configs/${id}`, data)
}

/** 删除存储配置 */
export function deleteConfig(id: number): Promise<null> {
  return del<null>(`/storage-configs/${id}`)
}
