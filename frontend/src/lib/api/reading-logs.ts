import { get, post } from "./client"
import type { ReadingLogDto, CreateReadingLogRequest } from "./types"

export function logProgress(data: CreateReadingLogRequest): Promise<ReadingLogDto> {
  return post<ReadingLogDto>("/reading-logs", data)
}

export function getProgress(paperId: number): Promise<ReadingLogDto[]> {
  return get<ReadingLogDto[]>(`/reading-logs/${paperId}`)
}

export function getRecent(page = 1, pageSize = 20): Promise<{ items: ReadingLogDto[]; total: number }> {
  return get<{ items: ReadingLogDto[]; total: number }>(`/reading-logs?page=${page}&pageSize=${pageSize}`)
}
