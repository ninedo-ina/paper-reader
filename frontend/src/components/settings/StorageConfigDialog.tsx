"use client"

import { useState, useCallback, useEffect } from "react"
import { useTranslations } from "next-intl"
import { useStorageStore } from "@/stores/storage-store"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import type { StorageType, StorageConfigDto, CreateStorageConfigRequest, UpdateStorageConfigRequest } from "@/lib/api/types"
import { X, Loader2, Plus, Pencil, Trash2, Check } from "lucide-react"

interface StorageConfigDialogProps {
  open: boolean
  onClose: () => void
}

const STORAGE_TYPES: { value: StorageType; label: string }[] = [
  { value: "GITHUB", label: "GitHub" },
  { value: "GITEE", label: "Gitee" },
  { value: "OSS", label: "Aliyun OSS" },
  { value: "S3", label: "S3 Compatible" },
]

const STORAGE_FIELDS: Record<StorageType, { key: string; label: string; required?: boolean; placeholder?: string }[]> = {
  GITHUB: [
    { key: "token", label: "Token", required: true, placeholder: "ghp_xxx" },
    { key: "repo", label: "Repository", required: true, placeholder: "owner/repo" },
    { key: "branch", label: "Branch", placeholder: "main" },
    { key: "path", label: "Path", placeholder: "papers/" },
  ],
  GITEE: [
    { key: "token", label: "Token", required: true, placeholder: "gitee token" },
    { key: "repo", label: "Repository", required: true, placeholder: "owner/repo" },
    { key: "branch", label: "Branch", placeholder: "master" },
    { key: "path", label: "Path", placeholder: "papers/" },
  ],
  OSS: [
    { key: "endpoint", label: "Endpoint", required: true, placeholder: "oss-cn-hangzhou.aliyuncs.com" },
    { key: "bucket", label: "Bucket", required: true },
    { key: "accessKey", label: "Access Key ID", required: true },
    { key: "secretKey", label: "Secret Access Key", required: true },
    { key: "region", label: "Region", placeholder: "cn-hangzhou" },
    { key: "path", label: "Path", placeholder: "papers/" },
  ],
  S3: [
    { key: "endpoint", label: "Endpoint", required: true },
    { key: "bucket", label: "Bucket", required: true },
    { key: "accessKey", label: "Access Key", required: true },
    { key: "secretKey", label: "Secret Key", required: true },
    { key: "region", label: "Region", placeholder: "us-east-1" },
    { key: "path", label: "Path", placeholder: "papers/" },
  ],
}

export function StorageConfigDialog({ open, onClose }: StorageConfigDialogProps) {
  const { configs, isLoading, error: storeError, loadConfigs, createConfig, updateConfig, deleteConfig } = useStorageStore()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [name, setName] = useState("")
  const [storageType, setStorageType] = useState<StorageType>("GITHUB")
  const [config, setConfig] = useState<Record<string, string>>({})
  const [isDefault, setIsDefault] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (open) loadConfigs()
  }, [open, loadConfigs])

  const resetForm = useCallback(() => {
    setEditingId(null)
    setName("")
    setStorageType("GITHUB")
    setConfig({})
    setIsDefault(false)
    setLocalError(null)
  }, [])

  const startEdit = useCallback((cfg: StorageConfigDto) => {
    setEditingId(cfg.id)
    setName(cfg.name)
    setStorageType(cfg.storageType as StorageType)
    setConfig(cfg.config as Record<string, string>)
    setIsDefault(cfg.isDefault)
    setLocalError(null)
  }, [])

  const handleSave = useCallback(async () => {
    if (!name.trim()) return
    setIsSaving(true)
    setLocalError(null)
    try {
      if (editingId) {
        const data: UpdateStorageConfigRequest = {
          name: name.trim(),
          config,
          isDefault,
        }
        await updateConfig(editingId, data)
      } else {
        const data: CreateStorageConfigRequest = {
          name: name.trim(),
          storageType,
          config,
          isDefault,
        }
        await createConfig(data)
      }
      resetForm()
    } catch (e) {
      setLocalError((e as Error).message)
    } finally {
      setIsSaving(false)
    }
  }, [name, storageType, config, isDefault, editingId, createConfig, updateConfig, resetForm])

  const handleDelete = useCallback(async (id: number) => {
    if (!confirm("确定删除此配置？已关联的论文将失去存储目标。")) return
    await deleteConfig(id)
  }, [deleteConfig])

  if (!open) return null

  const currentFields = STORAGE_FIELDS[storageType]
  const isEditing = editingId !== null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-surface-strong rounded-xl border border-white/10 w-full max-w-lg mx-4 max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] shrink-0">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">存储配置</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-1 rounded-md hover:bg-[var(--surface-2)] text-[var(--text-tertiary)] disabled:opacity-40"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-[var(--text-tertiary)]" />
            </div>
          ) : (
            <>
              {/* Config list */}
              {configs.map((cfg) => (
                <div
                  key={cfg.id}
                  className={`rounded-lg border p-3 transition-colors ${
                    cfg.isDefault ? "border-[var(--accent)]/30 bg-[var(--accent)]/5" : "border-[var(--border-color)] bg-[var(--surface-0)]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-[var(--text-primary)]">{cfg.name}</span>
                      <span className="text-[10px] text-[var(--text-tertiary)] ml-2 px-1.5 py-0.5 rounded bg-[var(--surface-2)]">
                        {cfg.storageType}
                      </span>
                      {cfg.isDefault && (
                        <span className="text-[10px] ml-1.5 px-1.5 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
                          默认
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(cfg)}
                        className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(cfg.id)}
                        className="p-1 rounded text-[var(--text-tertiary)] hover:text-red-500"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {configs.length === 0 && !isEditing && (
                <p className="text-sm text-[var(--text-tertiary)] text-center py-4">暂无存储配置</p>
              )}

              {/* Edit/create form */}
              {isEditing ? (
                <div className="rounded-lg border border-[var(--accent)]/30 bg-[var(--surface-0)] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">编辑配置</h3>
                    <button
                      onClick={resetForm}
                      className="p-0.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">名称 *</label>
                    <Input type="text" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>

                  {!isEditing && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-[var(--text-secondary)]">存储类型</label>
                      <select
                        value={storageType}
                        onChange={(e) => {
                          setStorageType(e.target.value as StorageType)
                          setConfig({})
                        }}
                        className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-0)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]/40"
                      >
                        {STORAGE_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <input
                      type="checkbox"
                      checked={isDefault}
                      onChange={(e) => setIsDefault(e.target.checked)}
                      className="rounded accent-[var(--accent)]"
                    />
                    设为默认
                  </label>

                  <div className="border-t border-[var(--border-subtle)] pt-3 space-y-3">
                    <p className="text-xs text-[var(--text-tertiary)] font-medium">{storageType} 配置</p>
                    {currentFields.map((field) => (
                      <div key={field.key} className="space-y-1">
                        <label className="text-xs text-[var(--text-tertiary)]">
                          {field.label}{field.required && " *"}
                        </label>
                        <Input
                          type={field.key.toLowerCase().includes("key") || field.key.toLowerCase().includes("token") || field.key.toLowerCase().includes("secret") ? "password" : "text"}
                          placeholder={field.placeholder}
                          value={config[field.key] || ""}
                          onChange={(e) => setConfig((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="secondary" size="sm" onClick={resetForm}>取消</Button>
                    <Button size="sm" onClick={handleSave} disabled={isSaving || !name.trim()}>
                      {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4 mr-1" />}
                      保存
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => setEditingId(-1)}
                >
                  <Plus className="size-4 mr-1.5" />
                  添加新配置
                </Button>
              )}
            </>
          )}
        </div>

        {(localError || storeError) && (
          <p className="px-6 pb-3 text-sm text-red-500">{localError || storeError}</p>
        )}
      </div>
    </div>
  )
}
