"use client"

import { useState, useCallback } from "react"
import { Plus, Trash2, Check, Loader2, Eye, EyeOff, Wifi, Pencil, X, Bot } from "lucide-react"
import { usePreferencesStore } from "@/stores/preferences-store"
import type { AiProvider } from "@/stores/preferences-store"
import { cn } from "@/lib/utils"

interface ProviderFormData {
  name: string
  baseUrl: string
  apiKey: string
  models: string
}

const DEFAULT_FORM: ProviderFormData = {
  name: "",
  baseUrl: "",
  apiKey: "",
  models: "",
}

export function AiConfigTab() {
  const { providers, activeProviderId, addProvider, updateProvider, removeProvider, setActiveProvider } =
    usePreferencesStore()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [form, setForm] = useState<ProviderFormData>(DEFAULT_FORM)
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; message: string } | null>(null)

  const resetForm = useCallback(() => {
    setForm(DEFAULT_FORM)
    setEditingId(null)
    setIsNew(false)
    setShowKey(false)
  }, [])

  const handleEdit = useCallback(
    (p: AiProvider) => {
      setIsNew(false)
      setEditingId(p.id)
      setForm({
        name: p.name,
        baseUrl: p.baseUrl,
        apiKey: p.apiKey,
        models: p.models.join(", "),
      })
      setShowKey(false)
      setTestResult(null)
    },
    [],
  )

  const handleSave = useCallback(() => {
    if (!form.name.trim() || !form.baseUrl.trim()) return

    const modelList = form.models
      .split(/[,，\s]+/)
      .map((m) => m.trim())
      .filter(Boolean)

    if (isNew) {
      addProvider({
        name: form.name.trim(),
        baseUrl: form.baseUrl.trim(),
        apiKey: form.apiKey.trim(),
        models: modelList,
      })
    } else if (editingId) {
      updateProvider(editingId, {
        name: form.name.trim(),
        baseUrl: form.baseUrl.trim(),
        apiKey: form.apiKey.trim(),
        models: modelList,
      })
    }
    resetForm()
  }, [form, isNew, editingId, addProvider, updateProvider, resetForm])

  const handleCancel = useCallback(() => {
    resetForm()
  }, [resetForm])

  const handleTest = useCallback(
    async (id: string) => {
      const provider = providers.find((p) => p.id === id)
      if (!provider) return

      setTesting(id)
      setTestResult(null)
      try {
        const baseUrl = provider.baseUrl.replace(/\/+$/, "")
        const res = await fetch(`${baseUrl}/models`, {
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
          },
        })
        if (res.ok) {
          const data = await res.json()
          const modelIds = (data.data || data).map((m: { id: string }) => m.id)
          if (modelIds.length > 0) {
            updateProvider(id, { models: modelIds })
          }
          setTestResult({ id, ok: true, message: `测试成功，获取到 ${modelIds.length} 个模型` })
        } else {
          const err = await res.text()
          // If /models fails, try /chat/completions with a trivial request
          const res2 = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${provider.apiKey}`,
            },
            body: JSON.stringify({
              model: provider.models[0] || "gpt-4o-mini",
              messages: [{ role: "user", content: "hi" }],
              max_tokens: 1,
            }),
          })
          if (res2.ok) {
            setTestResult({ id, ok: true, message: "连接成功（/models 不可用，但 chat 接口正常）" })
          } else {
            setTestResult({ id, ok: false, message: `连接失败: ${err.slice(0, 100)}` })
          }
        }
      } catch (e) {
        setTestResult({ id, ok: false, message: `连接失败: ${(e as Error).message}` })
      } finally {
        setTesting(null)
      }
    },
    [providers, updateProvider],
  )

  const isEditing = isNew || editingId !== null

  return (
    <div className="space-y-5">
      {/* Provider list */}
      {providers.length > 0 && (
        <div className="space-y-2">
          {providers.map((p) => (
            <div
              key={p.id}
              className={cn(
                "rounded-xl border p-4 transition-colors",
                activeProviderId === p.id
                  ? "border-[var(--accent)]/40 bg-[var(--accent)]/5"
                  : "border-[var(--border-subtle)] bg-[var(--surface-2)]",
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-medium text-[var(--text-primary)]">{p.name}</span>
                  <span className="text-xs text-[var(--text-tertiary)] font-mono truncate max-w-[200px]">{p.baseUrl}</span>
                  {activeProviderId === p.id && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      已激活
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleTest(p.id)}
                    disabled={testing === p.id}
                    className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] transition-colors"
                    title="测试连接"
                  >
                    {testing === p.id ? (
                      <Loader2 className="size-3.5 animate-spin text-[var(--text-tertiary)]" />
                    ) : (
                      <Wifi className="size-3.5 text-[var(--text-tertiary)]" />
                    )}
                  </button>
                  <button
                    onClick={() => handleEdit(p)}
                    className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] transition-colors"
                    title="编辑"
                  >
                    <Pencil className="size-3.5 text-[var(--text-tertiary)]" />
                  </button>
                  {activeProviderId !== p.id && (
                    <button
                      onClick={() => removeProvider(p.id)}
                      className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                      title="删除"
                    >
                      <Trash2 className="size-3.5 text-[var(--text-tertiary)] hover:text-red-500" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2.5">
                <span className="text-[10.5px] text-[var(--text-tertiary)]">
                  {p.models.length > 0 ? `${p.models.length} 个模型` : "无模型"}
                </span>
                {p.models.slice(0, 4).map((m) => (
                  <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-secondary)]">
                    {m}
                  </span>
                ))}
                {p.models.length > 4 && (
                  <span className="text-[10px] text-[var(--text-tertiary)]">+{p.models.length - 4}</span>
                )}
              </div>
              {/* Test result */}
              {testResult?.id === p.id && (
                <p
                  className={cn(
                    "text-xs mt-2",
                    testResult.ok ? "text-green-600" : "text-red-500",
                  )}
                >
                  {testResult.message}
                </p>
              )}
              {/* Activate button */}
              {activeProviderId !== p.id && (
                <button
                  onClick={() => setActiveProvider(p.id)}
                  className="flex items-center gap-1 mt-2.5 text-xs text-[var(--accent)] hover:underline"
                >
                  <Check className="size-3" />
                  激活此 Provider
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit form */}
      {isEditing ? (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 space-y-3">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">
            {isNew ? "添加 Provider" : "编辑 Provider"}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-[var(--text-tertiary)] mb-1">名称</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="如 OpenAI, DeepSeek"
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-0)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-tertiary)] mb-1">请求地址 (Base URL)</label>
              <input
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1"
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-0)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-tertiary)] mb-1">密钥 (API Key)</label>
              <div className="relative">
                <input
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  type={showKey ? "text" : "password"}
                  placeholder="sk-..."
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-0)] px-3 py-2 pr-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] font-mono"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                >
                  {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-tertiary)] mb-1">
                模型列表（逗号分隔，留空将以测试获取）
              </label>
              <input
                value={form.models}
                onChange={(e) => setForm({ ...form, models: e.target.value })}
                placeholder="gpt-4o, gpt-4o-mini"
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-0)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={!form.name.trim() || !form.baseUrl.trim()}
              className="flex items-center gap-1 px-4 py-1.5 text-xs bg-[var(--accent)] text-[var(--surface-1)] rounded-md hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-40"
            >
              <Check className="size-3" />
              保存
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsNew(true)}
          className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:border-[var(--text-secondary)] transition-colors w-full justify-center"
        >
          <Plus className="size-4" />
          <span className="text-sm">添加 Provider</span>
        </button>
      )}

      {/* Empty state */}
      {providers.length === 0 && !isEditing && (
        <div className="text-center py-8">
          <Bot className="size-10 text-[var(--text-tertiary)] mx-auto mb-2" />
          <p className="text-sm text-[var(--text-tertiary)]">尚未配置任何 Provider</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">点击上方按钮添加 OpenAI 兼容的 API 服务商</p>
        </div>
      )}
    </div>
  )
}
