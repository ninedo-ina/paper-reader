"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { usePaperStore } from "@/stores/paper-store"
import { useStorageStore } from "@/stores/storage-store"
import { getCategory } from "@/lib/paper-categories"
import { listVersions } from "@/lib/api/versions"
import type { PaperVersionDto, StorageConfigDto } from "@/lib/api/types"
import { PublishDialog } from "@/components/papers/PublishDialog"
import { Button } from "@/components/ui/Button"
import { ArrowLeft, Info, GitBranch, HardDrive, Upload, Loader2, Download } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { getDownloadUrl } from "@/lib/api/papers"

type TabKey = "info" | "versions" | "storage"

interface TabDef {
  key: TabKey
  label: string
  labelEn: string
  icon: typeof Info
}

const TABS: TabDef[] = [
  { key: "info", label: "基本信息", labelEn: "Basic Info", icon: Info },
  { key: "versions", label: "历史版本", labelEn: "Versions", icon: GitBranch },
  { key: "storage", label: "存储信息", labelEn: "Storage", icon: HardDrive },
]

export default function PaperDetailPage() {
  const params = useParams()
  const router = useRouter()
  const paperId = Number(params.id)
  const { currentPaper, loadPaper, isDetailLoading, error } = usePaperStore()
  const { configs, loadConfigs } = useStorageStore()

  const [activeTab, setActiveTab] = useState<TabKey>("info")
  const [versions, setVersions] = useState<PaperVersionDto[]>([])
  const [isLoadingVersions, setIsLoadingVersions] = useState(false)
  const [showPublish, setShowPublish] = useState(false)

  useEffect(() => {
    if (paperId) {
      loadPaper(paperId)
      loadConfigs()
    }
  }, [paperId, loadPaper, loadConfigs])

  const loadVersionsList = useCallback(async () => {
    setIsLoadingVersions(true)
    try {
      const v = await listVersions(paperId)
      setVersions(v)
    } catch {
      // ignore
    } finally {
      setIsLoadingVersions(false)
    }
  }, [paperId])

  useEffect(() => {
    if (activeTab === "versions") {
      loadVersionsList()
    }
  }, [activeTab, loadVersionsList])

  const handlePublished = useCallback(() => {
    loadVersionsList()
  }, [loadVersionsList])

  const storageConfig = currentPaper?.storageConfigId
    ? configs.find((c) => c.id === currentPaper.storageConfigId)
    : null

  if (isDetailLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--surface-1)]">
        <Loader2 className="size-6 animate-spin text-[var(--text-tertiary)]" />
      </div>
    )
  }

  if (error || !currentPaper) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[var(--surface-1)]">
        <p className="text-sm text-[var(--text-tertiary)]">{error || "Paper not found"}</p>
        <Button variant="secondary" onClick={() => router.push("/")}>
          <ArrowLeft className="size-4 mr-1.5" />
          Back
        </Button>
      </div>
    )
  }

  const catDef = getCategory(currentPaper.category)
  const extraFields = currentPaper.extraFields as Record<string, string> | undefined

  return (
    <div className="min-h-screen flex bg-[var(--surface-1)]">
      {/* Left vertical tab bar */}
      <nav className="w-16 flex flex-col items-center gap-1 py-4 border-r border-[var(--border-subtle)] glass-surface shrink-0">
        <button
          onClick={() => router.push("/")}
          className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors mb-4"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </button>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex flex-col items-center gap-0.5 p-2 rounded-lg transition-colors w-full ${
              activeTab === tab.key
                ? "text-[var(--accent)] bg-[var(--bg-active)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            }`}
            aria-label={tab.label}
          >
            <tab.icon className="size-5" />
            <span className="text-[9px] leading-none">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto">
          {/* Info Tab */}
          {activeTab === "info" && (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <h1 className="text-2xl font-bold text-[var(--text-primary)] leading-snug">
                  {currentPaper.title}
                </h1>
                <Button onClick={() => setShowPublish(true)}>
                  <Upload className="size-4 mr-1.5" />
                  发布
                </Button>
              </div>

              <div className="flex flex-wrap gap-3 text-sm text-[var(--text-secondary)]">
                {currentPaper.authors && (
                  <span className="px-2 py-0.5 rounded-md bg-[var(--surface-2)]">
                    {currentPaper.authors}
                  </span>
                )}
                {currentPaper.year && (
                  <span className="px-2 py-0.5 rounded-md bg-[var(--surface-2)]">
                    {currentPaper.year}
                  </span>
                )}
                {currentPaper.journal && (
                  <span className="px-2 py-0.5 rounded-md bg-[var(--surface-2)]">
                    {currentPaper.journal}
                  </span>
                )}
                {currentPaper.doi && (
                  <span className="px-2 py-0.5 rounded-md bg-[var(--surface-2)] font-mono text-xs">
                    {currentPaper.doi}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
                  {catDef?.label ?? currentPaper.category}
                </span>
                <span className="text-xs text-[var(--text-tertiary)]">
                  {currentPaper.sourceType}
                </span>
              </div>

              {/* Category-specific fields */}
              {extraFields && Object.keys(extraFields).length > 0 && (
                <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-0)] p-5">
                  <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">
                    {catDef?.label ?? ""} — 详细信息
                  </h3>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {Object.entries(extraFields).map(([key, val]) => {
                      const fieldDef = catDef?.fields.find((f) => f.key === key)
                      return (
                        <div key={key} className="flex flex-col gap-0.5">
                          <dt className="text-xs text-[var(--text-tertiary)]">{fieldDef?.label ?? key}</dt>
                          <dd className="text-sm text-[var(--text-primary)]">{String(val)}</dd>
                        </div>
                      )
                    })}
                  </dl>
                </div>
              )}

              {/* Abstract */}
              {currentPaper.abstractText && (
                <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-0)] p-5">
                  <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">摘要</h3>
                  <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
                    {currentPaper.abstractText}
                  </p>
                </div>
              )}

              {/* Download */}
              <div>
                <a
                  href={getDownloadUrl(currentPaper.id)}
                  className="inline-flex items-center gap-1.5 text-sm text-[var(--accent)] hover:underline"
                >
                  <Download className="size-4" />
                  下载 PDF
                </a>
              </div>
            </div>
          )}

          {/* Versions Tab */}
          {activeTab === "versions" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-[var(--text-primary)]">历史版本</h2>
                <Button onClick={() => setShowPublish(true)}>
                  <Upload className="size-4 mr-1.5" />
                  发布新版本
                </Button>
              </div>

              {isLoadingVersions ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="size-5 animate-spin text-[var(--text-tertiary)]" />
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-[var(--text-tertiary)]">暂无版本记录</p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">点击「发布」创建第一个版本</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {versions.map((v) => (
                    <div
                      key={v.id}
                      className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-0)] p-4 flex items-start justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                            v{v.version}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                              v.storagePushStatus === "success"
                                ? "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400"
                                : v.storagePushStatus === "failed"
                                ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                                : "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400"
                            }`}
                          >
                            {v.storagePushStatus}
                          </span>
                        </div>
                        {v.remark && (
                          <p className="text-sm text-[var(--text-secondary)] mt-1">{v.remark}</p>
                        )}
                        <p className="text-xs text-[var(--text-tertiary)] mt-2">{formatDate(v.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Storage Tab */}
          {activeTab === "storage" && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">存储信息</h2>

              {storageConfig ? (
                <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-0)] p-5">
                  <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">
                    {storageConfig.name}
                  </h3>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-xs text-[var(--text-tertiary)]">存储类型</dt>
                      <dd className="text-sm text-[var(--text-primary)]">{storageConfig.storageType}</dd>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-xs text-[var(--text-tertiary)]">默认</dt>
                      <dd className="text-sm text-[var(--text-primary)]">{storageConfig.isDefault ? "是" : "否"}</dd>
                    </div>
                    {Object.entries(storageConfig.config).map(([key, val]) => {
                      // Mask sensitive fields
                      const displayVal = ["token", "secretKey", "accessKey", "password"].some((s) =>
                        key.toLowerCase().includes(s.toLowerCase()),
                      )
                        ? "***"
                        : String(val)
                      return (
                        <div key={key} className="flex flex-col gap-0.5">
                          <dt className="text-xs text-[var(--text-tertiary)]">{key}</dt>
                          <dd className="text-sm text-[var(--text-primary)] font-mono text-xs">{displayVal}</dd>
                        </div>
                      )
                    })}
                  </dl>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-sm text-[var(--text-tertiary)]">未关联存储配置</p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">发布版本时无需推送到存储平台</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <PublishDialog
        open={showPublish}
        paperId={paperId}
        onClose={() => setShowPublish(false)}
        onPublished={handlePublished}
      />
    </div>
  )
}
