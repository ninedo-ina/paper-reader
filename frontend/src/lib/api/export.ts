// =============================================================================
// 论文导入 / 导出 API（W5）— 能力探测、生成产物（回挂版本）、二次下载、Markdown 导入
// =============================================================================

import { get, post, downloadBlob } from "./client"
import type {
  ExportCapabilitiesDto,
  ExportArtifactDto,
  CreateExportRequest,
  ImportResultDto,
} from "./types"

/** 探测当前服务端支持哪些导出格式（引擎缺失的格式 available=false，前端据此禁用）。 */
export function getExportCapabilities(paperId: number): Promise<ExportCapabilitiesDto> {
  return get<ExportCapabilitiesDto>(`/papers/${paperId}/export/capabilities`)
}

/** 生成一次导出产物并登记（回挂 versionId 指定的版本，为空则导出当前草稿）。 */
export function createExport(paperId: number, data: CreateExportRequest): Promise<ExportArtifactDto> {
  return post<ExportArtifactDto>(`/papers/${paperId}/export`, data)
}

/** 列出该论文已有的导出产物（用于版本页/弹层里二次下载）。 */
export function listExportArtifacts(paperId: number): Promise<ExportArtifactDto[]> {
  return get<ExportArtifactDto[]>(`/papers/${paperId}/export/artifacts`)
}

/**
 * 带 JWT 认证下载某个导出产物并触发浏览器保存。
 * 注意：不直接用 dto.downloadUrl（它含 /api 前缀，会和 client 的 API_URL 叠成 /api/api），
 * 这里按相对 API 前缀的路径重建。
 */
export async function downloadExportArtifact(
  paperId: number,
  artifactId: number,
  filename: string,
): Promise<void> {
  const blob = await downloadBlob(`/papers/${paperId}/export/artifacts/${artifactId}/download`)
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** 导入 Markdown，返回可加载进编辑器的 HTML 片段（由用户确认后再落库）。 */
export function importMarkdown(paperId: number, markdown: string): Promise<ImportResultDto> {
  return post<ImportResultDto>(`/papers/${paperId}/import/markdown`, { markdown })
}
