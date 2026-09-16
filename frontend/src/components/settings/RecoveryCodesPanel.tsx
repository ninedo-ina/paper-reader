"use client"

import { Copy, Download } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useToastStore } from "@/stores/toast-store"
import { copyToClipboard } from "@/lib/clipboard"

interface RecoveryCodesPanelProps {
  codes: string[]
  email?: string | null
  /** 由父组件决定复制/下载之后是否还可以继续操作 */
  onDone?: () => void
}

/** 只提供两种保存方式：一键复制，或下载成 txt 文本文件（不做 PDF）。 */
export function RecoveryCodesPanel({ codes, email, onDone }: RecoveryCodesPanelProps) {
  const t = useTranslations("settings")
  const locale = useLocale()

  const copyAll = async () => {
    try {
      await copyToClipboard(codes.join("\n"))
      useToastStore.getState().addToast({ message: t("recoveryCopied"), type: "success" })
    } catch {
      useToastStore.getState().addToast({ message: t("recoveryCopyFailed"), type: "error" })
    }
  }

  const downloadTxt = () => {
    const lines = [
      t("recoveryFileTitle"),
      email ? t("recoveryFileAccount", { email }) : null,
      t("recoveryFileGeneratedAt", { time: new Date().toLocaleString(locale) }),
      "",
      t("recoveryFileNotice1"),
      t("recoveryFileNotice2"),
      "",
      ...codes.map((code, index) => `${index + 1}. ${code}`),
      "",
    ].filter((line): line is string => line !== null)

    const blob = new Blob([lines.join("\r\n")], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = t("recoveryFileName")
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // 交给浏览器读完再回收，避免部分环境下下载被中断
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    useToastStore.getState().addToast({ message: t("recoveryDownloaded"), type: "success" })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4">
        <div className="grid grid-cols-3 gap-2">
          {codes.map((code, index) => (
            <div
              key={`${code}-${index}`}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2 text-center font-mono text-sm tracking-widest text-[var(--text-primary)]"
            >
              {code}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copyAll}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          <Copy className="size-3.5" />
          {t("copyAll")}
        </button>
        <button
          type="button"
          onClick={downloadTxt}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          <Download className="size-3.5" />
          {t("downloadTxt")}
        </button>
      </div>

      <p className="text-xs leading-5 text-[var(--text-tertiary)]">
        {t("recoverySummary", { count: codes.length })}
      </p>

      {onDone && (
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg px-5 py-2.5 text-sm font-semibold text-[var(--surface-1)] transition-all hover:brightness-110"
          style={{ background: "var(--accent)" }}
        >
          {t("recoverySaved")}
        </button>
      )}
    </div>
  )
}
