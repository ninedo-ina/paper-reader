"use client"

import { useCallback, useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@/components/ui/Button"
import {
  getExportCapabilities,
  createExport,
  listExportArtifacts,
  downloadExportArtifact,
} from "@/lib/api/export"
import { listVersions } from "@/lib/api/versions"
import type { ExportArtifactDto, ExportCapabilitiesDto, PaperVersionDto } from "@/lib/api/types"
import { formatDate, formatFileSize } from "@/lib/utils"
import { X, Loader2, Download, FileDown } from "lucide-react"

interface ExportDialogProps {
  open: boolean
  paperId: number
  paperTitle: string
  /** 打开时预选的版本；空表示导出当前草稿。 */
  defaultVersionId?: number | null
  onClose: () => void
}

/** 文件名里去掉不能落盘的字符，避免浏览器保存时被截断/报错。 */
function safeName(title: string): string {
  return (title.trim() || "paper").replace(/[/\\:*?"<>|]+/g, "_").slice(0, 120)
}

export function ExportDialog({ open, paperId, paperTitle, defaultVersionId, onClose }: ExportDialogProps) {
  const t = useTranslations("export")
  const c = useTranslations("common")
  const locale = useLocale()

  const [caps, setCaps] = useState<ExportCapabilitiesDto | null>(null)
  const [versions, setVersions] = useState<PaperVersionDto[]>([])
  const [artifacts, setArtifacts] = useState<ExportArtifactDto[]>([])
  const [format, setFormat] = useState<string>("")
  const [versionId, setVersionId] = useState<number | null>(defaultVersionId ?? null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const formatLabel = useCallback(
    (id: string) => {
      const key = `format${id.charAt(0).toUpperCase()}${id.slice(1)}`
      const label = t(key)
      // 缺翻译时 next-intl 回落成 key 本身，这里退回格式 id 更友好
      return label === key ? id.toUpperCase() : label
    },
    [t],
  )

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setVersionId(defaultVersionId ?? null)
    Promise.all([
      getExportCapabilities(paperId),
      listExportArtifacts(paperId).catch(() => [] as ExportArtifactDto[]),
      listVersions(paperId).catch(() => [] as PaperVersionDto[]),
    ])
      .then(([capabilities, arts, vers]) => {
        if (cancelled) return
        setCaps(capabilities)
        setArtifacts(arts)
        setVersions(vers)
        // 默认选中第一个可用格式，全都不可用时留空并禁用生成
        const firstAvailable = capabilities.formats.find((f) => f.available)
        setFormat((prev) => prev || firstAvailable?.id || "")
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, paperId, defaultVersionId])

  const handleClose = useCallback(() => {
    if (!generating) onClose()
  }, [generating, onClose])

  const extOf = useCallback(
    (fmt: string) => caps?.formats.find((f) => f.id === fmt)?.ext ?? fmt,
    [caps],
  )

  const handleGenerate = useCallback(async () => {
    if (!format) return
    setGenerating(true)
    setError(null)
    try {
      const artifact = await createExport(paperId, { format, versionId: versionId ?? undefined })
      setArtifacts((prev) => [artifact, ...prev.filter((a) => a.id !== artifact.id)])
      await downloadExportArtifact(paperId, artifact.id, `${safeName(paperTitle)}.${extOf(format)}`)
    } catch (e) {
      // 引擎不可用/繁忙/失败/超限的文案由服务端给出（1011/1012/1013 等），直接透传
      setError((e as Error).message)
    } finally {
      setGenerating(false)
    }
  }, [format, versionId, paperId, paperTitle, extOf])

  const handleDownload = useCallback(
    async (a: ExportArtifactDto) => {
      try {
        await downloadExportArtifact(paperId, a.id, `${safeName(paperTitle)}.${extOf(a.format)}`)
      } catch (e) {
        setError((e as Error).message)
      }
    },
    [paperId, paperTitle, extOf],
  )

  if (!open) return null

  const versionTag = (vid: number | null) => {
    if (vid === null) return t("currentDraft")
    const v = versions.find((x) => x.id === vid)
    return v ? `v${v.version}` : t("currentDraft")
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative glass-surface-strong rounded-xl border border-white/10 w-full max-w-lg mx-4 p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t("exportDocument")}</h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={generating}
            className="p-1 rounded-md hover:bg-[var(--surface-2)] text-[var(--text-tertiary)] disabled:opacity-40"
            aria-label={c("cancel")}
          >
            <X className="size-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-[var(--text-tertiary)]" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* 格式选择 */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">{t("format")}</label>
              <div className="grid grid-cols-3 gap-2">
                {caps?.formats.map((f) => {
                  const active = f.id === format
                  return (
                    <button
                      key={f.id}
                      type="button"
                      disabled={!f.available || generating}
                      onClick={() => setFormat(f.id)}
                      title={f.available ? undefined : t("unavailableHint")}
                      aria-pressed={active}
                      className={`px-3 py-2 rounded-lg text-sm border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        active
                          ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                          : "border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
                      }`}
                    >
                      {formatLabel(f.id)}
                      {!f.available && (
                        <span className="block text-[10px] text-[var(--text-tertiary)] leading-none mt-0.5">
                          {t("unavailable")}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 内容范围：当前草稿 or 某个已发布版本 */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">{t("scope")}</label>
              <select
                value={versionId ?? ""}
                disabled={generating}
                onChange={(e) => setVersionId(e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-0)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]/40"
              >
                <option value="">{t("currentDraft")}</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version}
                    {v.remark ? ` · ${v.remark}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* 生成并下载 */}
            <div>
              <Button
                type="button"
                onClick={handleGenerate}
                disabled={generating || !format}
                className="w-full justify-center"
              >
                {generating ? (
                  <>
                    <Loader2 className="size-4 mr-1.5 animate-spin" />
                    {t("generating")}
                  </>
                ) : (
                  <>
                    <FileDown className="size-4 mr-1.5" />
                    {t("generate")}
                  </>
                )}
              </Button>
              {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
            </div>

            {/* 历史产物：可二次下载 */}
            <div className="space-y-2 border-t border-[var(--border-subtle)] pt-4">
              <h3 className="text-sm font-medium text-[var(--text-secondary)]">{t("history")}</h3>
              {artifacts.length === 0 ? (
                <p className="text-xs text-[var(--text-tertiary)]">{t("noArtifacts")}</p>
              ) : (
                <ul className="space-y-2">
                  {artifacts.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--surface-0)] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-semibold uppercase text-[var(--text-primary)]">
                            {a.format}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--text-tertiary)]">
                            {versionTag(a.versionId)}
                          </span>
                          {a.byteSize != null && (
                            <span className="text-[10px] text-[var(--text-tertiary)]">
                              {formatFileSize(a.byteSize)}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 truncate">
                          {formatDate(a.createdAt, locale)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDownload(a)}
                        className="inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:underline shrink-0"
                      >
                        <Download className="size-3.5" />
                        {t("download")}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
