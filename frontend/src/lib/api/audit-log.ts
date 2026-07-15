import { get } from "./client"
import type { PageResponse } from "./types"

export interface AuditLogEntry {
  id: number
  event: string
  operator: string
  createdAt: string
}

export function getAuditLogs(page = 0, size = 20): Promise<PageResponse<AuditLogEntry>> {
  return get<PageResponse<AuditLogEntry>>(`/audit-logs?page=${page}&size=${size}`)
}
