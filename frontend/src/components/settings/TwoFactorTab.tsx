"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import { Copy, Loader2, ShieldCheck, ShieldOff, Smartphone } from "lucide-react"
import { useToastStore } from "@/stores/toast-store"
import { useUserStore } from "@/stores/user-store"
import * as securityApi from "@/lib/api/security"
import { copyToClipboard } from "@/lib/clipboard"
import type { TwoFactorSetup, TwoFactorStatus } from "@/lib/api/types"
import { ThemeAwareQrCode } from "./ThemeAwareQrCode"
import { RecoveryCodesPanel } from "./RecoveryCodesPanel"
import { OtpInput } from "./OtpInput"

type Step = "loading" | "idle" | "bind" | "codes"

/**
 * 个人中心 · 两步验证。
 * 首次开启与关闭后再次开启走同一套「扫码绑定 → 校验密码和动态码 → 保存恢复码」流程，
 * 两种情况下都会重新下发 9 个恢复码，保证账号始终能用恢复码找回。
 */
export function TwoFactorTab() {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null)
  const [step, setStep] = useState<Step>("loading")
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const email = useUserStore((s) => s.profile?.email)

  const loadStatus = useCallback(async () => {
    try {
      const res = await securityApi.getTwoFactorStatus()
      setStatus(res)
      setStep("idle")
    } catch (e) {
      setStep("idle")
      useToastStore.getState().addToast({ message: (e as Error).message || "加载两步验证状态失败", type: "error" })
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  if (step === "loading") {
    return (
      <div className="flex items-center justify-center pt-16">
        <Loader2 className="size-5 animate-spin text-[var(--text-tertiary)]" />
      </div>
    )
  }

  if (step === "bind") {
    return (
      <BindWizard
        onCancel={() => setStep("idle")}
        onFinished={(codes) => {
          setRecoveryCodes(codes)
          setStep("codes")
        }}
      />
    )
  }

  if (step === "codes") {
    return (
      <RecoveryCodesPanel
        codes={recoveryCodes}
        email={email}
        onDone={() => {
          setRecoveryCodes([])
          setStep("idle")
          loadStatus()
        }}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4">
        {status?.enabled ? (
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[var(--accent)]" />
        ) : (
          <ShieldOff className="mt-0.5 size-5 shrink-0 text-[var(--text-tertiary)]" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--text-primary)]">
            {status?.enabled ? "两步验证已开启" : "两步验证未开启"}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">
            {status?.enabled
              ? `登录时需要额外输入身份验证器上的 6 位动态码；已信任的设备可跳过。剩余可用恢复码 ${status.recoveryCodesRemaining} / ${status.recoveryCodesTotal} 个。`
              : "开启后，登录时除密码外还需输入身份验证器上的 6 位动态码，并会下发 9 个恢复码用于找回账号。"}
          </p>
        </div>
      </div>

      {status?.enabled ? (
        <>
          <RegenerateSection onDone={(codes) => { setRecoveryCodes(codes); setStep("codes") }} />
          <DisableSection onDone={loadStatus} />
        </>
      ) : (
        <button
          type="button"
          onClick={() => setStep("bind")}
          className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-[var(--surface-1)] transition-all hover:brightness-110"
          style={{ background: "var(--accent)" }}
        >
          <Smartphone className="size-4" />
          扫码绑定并开启
        </button>
      )}
    </div>
  )
}

/**
 * 表单行：宽屏下标签在左、输入在右，中间留出固定间距（标签列定宽对齐）。
 * 窄屏放不下时自动改回上下堆叠，避免输入框被挤成一条缝。
 */
function FieldRow({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-6">
      <label htmlFor={htmlFor} className="shrink-0 text-xs font-medium text-[var(--text-secondary)] sm:w-24 sm:text-right">
        {label}
      </label>
      <div className="min-w-0 sm:flex-1">{children}</div>
    </div>
  )
}

/** 扫码绑定：生成密钥 → 扫码 → 校验密码 + 动态码 → 下发恢复码 */
function BindWizard({
  onCancel,
  onFinished,
}: {
  onCancel: () => void
  onFinished: (codes: string[]) => void
}) {
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null)
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    securityApi
      .setupTwoFactor()
      .then((res) => {
        if (!cancelled) setSetup(res)
      })
      .catch((e: Error) => {
        if (!cancelled) {
          useToastStore.getState().addToast({ message: e.message || "生成密钥失败", type: "error" })
          onCancel()
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [onCancel])

  const submit = useCallback(async () => {
    if (!password) {
      useToastStore.getState().addToast({ message: "请输入当前密码", type: "error" })
      return
    }
    if (!/^\d{6}$/.test(code.trim())) {
      useToastStore.getState().addToast({ message: "请输入身份验证器上的 6 位动态码", type: "error" })
      return
    }
    setSubmitting(true)
    try {
      const res = await securityApi.enableTwoFactor({ password, code: code.trim() })
      useToastStore.getState().addToast({ message: "两步验证已开启", type: "success" })
      onFinished(res.recoveryCodes)
    } catch (e) {
      useToastStore.getState().addToast({ message: (e as Error).message || "开启失败", type: "error" })
    } finally {
      setSubmitting(false)
    }
  }, [password, code, onFinished])

  const copySecret = async () => {
    if (!setup?.secret) return
    try {
      await copyToClipboard(setup.secret)
      useToastStore.getState().addToast({ message: "密钥已复制到剪贴板", type: "success" })
    } catch {
      useToastStore.getState().addToast({ message: "复制失败，请手动选择后复制", type: "error" })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center pt-16">
        <Loader2 className="size-5 animate-spin text-[var(--text-tertiary)]" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <ol className="space-y-1.5 text-xs leading-5 text-[var(--text-secondary)]">
        <li>1. 在手机上下载任意身份验证器 App（如 Google Authenticator、Microsoft Authenticator）。</li>
        <li>2. 扫描下方二维码，或手动输入密钥。</li>
        <li>3. 输入 App 中显示的 6 位动态码与当前密码，完成绑定。</li>
      </ol>

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        {setup && <ThemeAwareQrCode value={setup.otpauthUri} />}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-[var(--text-secondary)]">无法扫码？手动输入密钥</p>
            <button
              type="button"
              onClick={copySecret}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            >
              <Copy className="size-3.5" />
              复制
            </button>
          </div>
          <code className="block break-all rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 font-mono text-xs tracking-wider text-[var(--text-primary)]">
            {setup?.secret}
          </code>
          <p className="text-xs text-[var(--text-tertiary)]">
            算法 SHA1 · {setup?.digits ?? 6} 位 · {setup?.period ?? 30} 秒刷新
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <FieldRow label="当前密码" htmlFor="two-factor-password">
          <input
            id="two-factor-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </FieldRow>

        <FieldRow label="6 位动态码" htmlFor="two-factor-code">
          <OtpInput id="two-factor-code" value={code} onChange={setCode} />
        </FieldRow>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-[var(--surface-1)] transition-all disabled:opacity-60 hover:brightness-110"
          style={{ background: "var(--accent)" }}
        >
          {submitting && <Loader2 className="size-3.5 animate-spin" />}
          {submitting ? "校验中..." : "确认开启"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[var(--border-subtle)] px-4 py-2.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          取消
        </button>
      </div>
    </div>
  )
}

/** 重新生成恢复码：只需密码，旧码立即失效 */
function RegenerateSection({ onDone }: { onDone: (codes: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = useCallback(async () => {
    if (!password) {
      useToastStore.getState().addToast({ message: "请输入当前密码", type: "error" })
      return
    }
    setBusy(true)
    try {
      const res = await securityApi.regenerateRecoveryCodes({ password })
      useToastStore.getState().addToast({ message: "恢复码已重新生成，旧恢复码立即失效", type: "success" })
      setPassword("")
      setOpen(false)
      onDone(res.recoveryCodes)
    } catch (e) {
      useToastStore.getState().addToast({ message: (e as Error).message || "生成失败", type: "error" })
    } finally {
      setBusy(false)
    }
  }, [password, onDone])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
      >
        重新生成恢复码
      </button>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4">
      <p className="text-xs font-medium text-[var(--text-secondary)]">输入当前密码以重新生成 9 个恢复码</p>
      <FieldRow label="当前密码" htmlFor="regenerate-password">
        <input
          id="regenerate-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
      </FieldRow>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-[var(--surface-1)] transition-colors disabled:opacity-60"
          style={{ background: "var(--accent)" }}
        >
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          {busy ? "生成中..." : "确认生成"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setPassword("") }}
          className="rounded-lg px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          取消
        </button>
      </div>
    </div>
  )
}

/** 关闭两步验证：密码 + 动态码双校验，关闭后所有恢复码立即失效 */
function DisableSection({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = useCallback(async () => {
    if (!password || !code.trim()) {
      useToastStore.getState().addToast({ message: "请填写当前密码与动态码", type: "error" })
      return
    }
    setBusy(true)
    try {
      await securityApi.disableTwoFactor({ password, code: code.trim() })
      useToastStore.getState().addToast({ message: "两步验证已关闭，恢复码已全部失效", type: "success" })
      setPassword("")
      setCode("")
      setOpen(false)
      onDone()
    } catch (e) {
      useToastStore.getState().addToast({ message: (e as Error).message || "关闭失败", type: "error" })
    } finally {
      setBusy(false)
    }
  }, [password, code, onDone])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
      >
        关闭两步验证
      </button>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4">
      <p className="text-xs font-medium text-[var(--text-secondary)]">
        关闭后登录不再需要动态码，已下发的恢复码会立即失效。请用密码 + 动态码确认，动态码也可以用恢复码代替。
      </p>
      <FieldRow label="当前密码" htmlFor="disable-password">
        <input
          id="disable-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
      </FieldRow>
      <FieldRow label="动态码" htmlFor="disable-code">
        <OtpInput id="disable-code" value={code} onChange={setCode} variant="inset" label="动态码或恢复码" />
      </FieldRow>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors disabled:opacity-60 hover:bg-[var(--bg-hover)]"
        >
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          {busy ? "处理中..." : "确认关闭"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setPassword(""); setCode("") }}
          className="rounded-lg px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          取消
        </button>
      </div>
    </div>
  )
}
