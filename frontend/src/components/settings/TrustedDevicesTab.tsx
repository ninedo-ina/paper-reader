"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, MonitorSmartphone, ShieldCheck, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToastStore } from "@/stores/toast-store"
import * as securityApi from "@/lib/api/security"
import type { TrustedDevice } from "@/lib/api/types"

/**
 * 个人中心 · 信任设备。
 * 列出所有登录过 / 被保存的设备，可勾选后手动删除。
 * 删除后该设备已签发的登录 token 立即失效（后端鉴权会校验设备是否还在），必须重新登录。
 */
export function TrustedDevicesTab() {
  const [devices, setDevices] = useState<TrustedDevice[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await securityApi.getTrustedDevices()
      setDevices(res)
      setSelected(new Set())
    } catch (e) {
      useToastStore.getState().addToast({ message: (e as Error).message || "加载设备列表失败", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const removeSelected = useCallback(async () => {
    const ids = [...selected]
    if (ids.length === 0) return
    setDeleting(true)
    try {
      const res = await securityApi.deleteTrustedDevices(ids)
      useToastStore.getState().addToast({
        message: `已删除 ${res?.removed ?? ids.length} 台设备，该设备需重新登录`,
        type: "success",
      })
      await load()
    } catch (e) {
      useToastStore.getState().addToast({ message: (e as Error).message || "删除设备失败", type: "error" })
    } finally {
      setDeleting(false)
    }
  }, [selected, load])

  if (loading) {
    return (
      <div className="flex items-center justify-center pt-16">
        <Loader2 className="size-5 animate-spin text-[var(--text-tertiary)]" />
      </div>
    )
  }

  if (devices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center pt-16 text-center">
        <MonitorSmartphone className="mb-4 size-12 text-[var(--text-tertiary)]" />
        <h3 className="mb-2 text-sm font-medium text-[var(--text-primary)]">信任设备</h3>
        <p className="max-w-[280px] text-xs leading-5 text-[var(--text-tertiary)]">
          暂无登录过的设备。开启两步验证后，被信任的设备再次登录时可只输入密码，无需动态码。
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs leading-5 text-[var(--text-tertiary)]">
        以下是登录过并保存的设备。被信任的设备在两步验证开启后可免动态码登录；删除后该设备已签发的登录凭证立即失效，需要重新登录。
      </p>

      <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)]">
        {devices.map((device, index) => {
          const checked = selected.has(device.id)
          return (
            <button
              type="button"
              key={device.id}
              onClick={() => toggle(device.id)}
              className={cn(
                "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                index !== devices.length - 1 && "border-b border-[var(--border-subtle)]",
                checked ? "bg-[var(--accent)]/8" : "hover:bg-[var(--bg-hover)]",
              )}
            >
              <input
                type="checkbox"
                readOnly
                checked={checked}
                tabIndex={-1}
                className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium text-[var(--text-primary)]">
                    {device.deviceName || "未知设备"}
                  </span>
                  {device.current && (
                    <span className="rounded-full bg-[var(--accent)]/12 px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">
                      当前设备
                    </span>
                  )}
                  {device.trusted && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
                      <ShieldCheck className="size-3" />
                      已信任
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-xs text-[var(--text-tertiary)]">
                  {device.userAgent || "未知客户端"}
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                  IP {device.ipAddress || "未知"} · 最近登录 {formatTime(device.lastLoginAt)}
                  {device.trustedUntil ? ` · 信任至 ${formatTime(device.trustedUntil)}` : ""}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={removeSelected}
          disabled={selected.size === 0 || deleting}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors disabled:cursor-not-allowed disabled:opacity-50 hover:bg-[var(--bg-hover)]"
        >
          {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          {deleting ? "删除中..." : `删除所选${selected.size > 0 ? ` (${selected.size})` : ""}`}
        </button>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)]"
          >
            取消选择
          </button>
        )}
      </div>
    </div>
  )
}

function formatTime(value: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}
