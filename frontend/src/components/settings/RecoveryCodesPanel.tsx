"use client"

import { Copy, Download } from "lucide-react"
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
  const copyAll = async () => {
    try {
      await copyToClipboard(codes.join("\n"))
      useToastStore.getState().addToast({ message: "恢复码已复制到剪贴板", type: "success" })
    } catch {
      useToastStore.getState().addToast({ message: "复制失败，请手动选择后复制", type: "error" })
    }
  }

  const downloadTxt = () => {
    const lines = [
      "笨迪论文助手 · 两步验证恢复码",
      email ? `账号：${email}` : null,
      `生成时间：${new Date().toLocaleString("zh-CN")}`,
      "",
      "每个恢复码只能使用一次，请妥善保存。",
      "关闭两步验证后，这些恢复码将立即失效。",
      "",
      ...codes.map((code, index) => `${index + 1}. ${code}`),
      "",
    ].filter((line): line is string => line !== null)

    const blob = new Blob([lines.join("\r\n")], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "笨迪论文助手-两步验证恢复码.txt"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // 交给浏览器读完再回收，避免部分环境下下载被中断
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    useToastStore.getState().addToast({ message: "恢复码已下载为 txt 文件", type: "success" })
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
          一键复制
        </button>
        <button
          type="button"
          onClick={downloadTxt}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          <Download className="size-3.5" />
          下载 TXT 文件
        </button>
      </div>

      <p className="text-xs leading-5 text-[var(--text-tertiary)]">
        共 {codes.length} 个恢复码，每个都是 6 位数字，且只能使用一次。请在不开启两步验证时无法登录的情况下用它找回账号。
      </p>

      {onDone && (
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg px-5 py-2.5 text-sm font-semibold text-[var(--surface-1)] transition-all hover:brightness-110"
          style={{ background: "var(--accent)" }}
        >
          我已妥善保存
        </button>
      )}
    </div>
  )
}
