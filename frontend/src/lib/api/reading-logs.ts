import { get, post } from "./client"
import type { ReadingLogDto, CreateReadingLogRequest } from "./types"

export function logProgress(data: CreateReadingLogRequest): Promise<ReadingLogDto> {
  return post<ReadingLogDto>("/reading-logs", data)
}

export function getProgress(paperId: number): Promise<ReadingLogDto[]> {
  return get<ReadingLogDto[]>(`/reading-logs/paper/${paperId}`)
}

export function getRecent(limit = 50): Promise<ReadingLogDto[]> {
  return get<ReadingLogDto[]>(`/reading-logs/recent?limit=${limit}`)
}
