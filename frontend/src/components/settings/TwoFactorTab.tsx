"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import { Copy, Loader2, ShieldCheck, ShieldOff, Smartphone } from "lucide-react"
import { useTranslations } from "next-intl"
import { useToastStore } from "@/stores/toast-store"
import { useUserStore } from "@/stores/user-store"
import * as securityApi from "@/lib/api/security"
import { copyToClipboard } from "@/lib/clipboard"
import type { TwoFactorSetup, TwoFactorStatus } from "@/lib/api/types"
import { QrCodeCard } from "./QrCodeCard"
import { RecoveryCodesPanel } from "./RecoveryCodesPanel"
import { OtpInput } from "./OtpInput"

type Step = "loading" | "idle" | "bind" | "codes"

/**
 * 个人中心 · 两步验证。
 * 首次开启与关闭后再次开启走同一套「扫码绑定 → 校验密码和动态码 → 保存恢复码」流程，
 * 两种情况下都会重新下发 9 个恢复码，保证账号始终能用恢复码找回。
 */
export function TwoFactorTab() {
  const t = useTranslations("settings")
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
      useToastStore.getState().addToast({ message: (e as Error).message || t("tfLoadFailed"), type: "error" })
    }
  }, [t])

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
            {status?.enabled ? t("tfEnabled") : t("tfDisabled")}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">
            {status?.enabled
              ? t("tfEnabledHint", { remaining: status.recoveryCodesRemaining, total: status.recoveryCodesTotal })
              : t("tfDisabledHint")}
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
          {t("tfStart")}
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
  const t = useTranslations("settings")
  const tc = useTranslations("common")
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
          useToastStore.getState().addToast({ message: e.message || t("tfSecretFailed"), type: "error" })
          onCancel()
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [onCancel, t])

  const submit = useCallback(async () => {
    if (!password) {
      useToastStore.getState().addToast({ message: t("tfNeedPassword"), type: "error" })
      return
    }
    if (!/^\d{6}$/.test(code.trim())) {
      useToastStore.getState().addToast({ message: t("tfNeedCode"), type: "error" })
      return
    }
    setSubmitting(true)
    try {
      const res = await securityApi.enableTwoFactor({ password, code: code.trim() })
      useToastStore.getState().addToast({ message: t("tfEnabledToast"), type: "success" })
      onFinished(res.recoveryCodes)
    } catch (e) {
      useToastStore.getState().addToast({ message: (e as Error).message || t("tfEnableFailed"), type: "error" })
    } finally {
      setSubmitting(false)
    }
  }, [password, code, onFinished, t])

  const copySecret = async () => {
    if (!setup?.secret) return
    try {
      await copyToClipboard(setup.secret)
      useToastStore.getState().addToast({ message: t("tfSecretCopied"), type: "success" })
    } catch {
      useToastStore.getState().addToast({ message: t("tfCopyFailed"), type: "error" })
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
        <li>{t("tfStep1")}</li>
        <li>{t("tfStep2")}</li>
        <li>{t("tfStep3")}</li>
      </ol>

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        {setup && <QrCodeCard value={setup.otpauthUri} />}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-[var(--text-secondary)]">{t("tfManualSecret")}</p>
            <button
              type="button"
              onClick={copySecret}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            >
              <Copy className="size-3.5" />
              {t("tfCopy")}
            </button>
          </div>
          <code className="block break-all rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 font-mono text-xs tracking-wider text-[var(--text-primary)]">
            {setup?.secret}
          </code>
          <p className="text-xs text-[var(--text-tertiary)]">
            {t("tfAlgorithm", { digits: setup?.digits ?? 6, period: setup?.period ?? 30 })}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <FieldRow label={t("tfCurrentPassword")} htmlFor="two-factor-password">
          <input
            id="two-factor-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </FieldRow>

        <FieldRow label={t("tfSixDigitCode")} htmlFor="two-factor-code">
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
          {submitting ? t("tfVerifying") : t("tfConfirmEnable")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[var(--border-subtle)] px-4 py-2.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          {tc("cancel")}
        </button>
      </div>
    </div>
  )
}

/** 重新生成恢复码：只需密码，旧码立即失效 */
function RegenerateSection({ onDone }: { onDone: (codes: string[]) => void }) {
  const t = useTranslations("settings")
  const tc = useTranslations("common")
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = useCallback(async () => {
    if (!password) {
      useToastStore.getState().addToast({ message: t("tfNeedPassword"), type: "error" })
      return
    }
    setBusy(true)
    try {
      const res = await securityApi.regenerateRecoveryCodes({ password })
      useToastStore.getState().addToast({ message: t("tfRegeneratedToast"), type: "success" })
      setPassword("")
      setOpen(false)
      onDone(res.recoveryCodes)
    } catch (e) {
      useToastStore.getState().addToast({ message: (e as Error).message || t("tfRegenerateFailed"), type: "error" })
    } finally {
      setBusy(false)
    }
  }, [password, onDone, t])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
      >
        {t("tfRegenerate")}
      </button>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4">
      <p className="text-xs font-medium text-[var(--text-secondary)]">{t("tfRegenerateHint")}</p>
      <FieldRow label={t("tfCurrentPassword")} htmlFor="regenerate-password">
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
          {busy ? t("tfGenerating") : t("tfConfirmGenerate")}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setPassword("") }}
          className="rounded-lg px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          {tc("cancel")}
        </button>
      </div>
    </div>
  )
}

/** 关闭两步验证：密码 + 动态码双校验，关闭后所有恢复码立即失效 */
function DisableSection({ onDone }: { onDone: () => void }) {
  const t = useTranslations("settings")
  const tc = useTranslations("common")
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = useCallback(async () => {
    if (!password || !code.trim()) {
      useToastStore.getState().addToast({ message: t("tfNeedPasswordAndCode"), type: "error" })
      return
    }
    setBusy(true)
    try {
      await securityApi.disableTwoFactor({ password, code: code.trim() })
      useToastStore.getState().addToast({ message: t("tfDisabledToast"), type: "success" })
      setPassword("")
      setCode("")
      setOpen(false)
      onDone()
    } catch (e) {
      useToastStore.getState().addToast({ message: (e as Error).message || t("tfDisableFailed"), type: "error" })
    } finally {
      setBusy(false)
    }
  }, [password, code, onDone, t])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
      >
        {t("tfDisable")}
      </button>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4">
      <p className="text-xs font-medium text-[var(--text-secondary)]">
        {t("tfDisableHint")}
      </p>
      <FieldRow label={t("tfCurrentPassword")} htmlFor="disable-password">
        <input
          id="disable-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
      </FieldRow>
      <FieldRow label={t("otpLabel")} htmlFor="disable-code">
        <OtpInput id="disable-code" value={code} onChange={setCode} variant="inset" label={t("otpOrRecoveryCode")} />
      </FieldRow>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors disabled:opacity-60 hover:bg-[var(--bg-hover)]"
        >
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          {busy ? t("tfProcessing") : t("tfConfirmDisable")}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setPassword(""); setCode("") }}
          className="rounded-lg px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          {tc("cancel")}
        </button>
      </div>
    </div>
  )
}
