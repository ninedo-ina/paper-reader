"use client"

import { useTranslations } from "next-intl"
import { useRef } from "react"
import type { ClipboardEvent, KeyboardEvent } from "react"

interface OtpInputProps {
  /** 已输入的动态码，纯数字，长度 0 ~ length，不做左侧补空格 */
  value: string
  onChange: (value: string) => void
  /** 格子数量，默认 6（身份验证器就是 6 位） */
  length?: number
  /** 第一格的 id，供 <label htmlFor> 点击聚焦 */
  id?: string
  autoFocus?: boolean
  disabled?: boolean
  /**
   * 底色：默认格子用 surface-2（适合放在页面底上）；
   * 放在已经铺了 surface-2 的面板里时传 inset，格子改用 surface-1 才不会糊成一片。
   */
  variant?: "default" | "inset"
  /** 无障碍名称，会拼成「动态码第 1 位」这样；不传则用界面语言里的默认文案 */
  label?: string
}

/**
 * 6 位动态码输入：一格一位。
 * - 输入自动跳下一格，退格空格子时回退并清掉上一位
 * - 支持整段粘贴 / 系统一次性验证码自动填充（铺满时从头覆盖）
 * - 左右方向键移动，聚焦即全选，改一位不会连带清掉后面
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  id,
  autoFocus,
  disabled,
  variant = "default",
  label,
}: OtpInputProps) {
  const t = useTranslations("settings")
  const resolvedLabel = label ?? t("otpLabel")
  const cells = useRef<(HTMLInputElement | null)[]>([])

  const focusCell = (index: number) => {
    const target = cells.current[Math.max(0, Math.min(length - 1, index))]
    target?.focus()
    target?.select()
  }

  /** 从 start 开始铺开一串数字，多出来的截断 */
  const fillFrom = (start: number, digits: string) => {
    // 系统自动填充会把整串码塞进当前这一格，这时应该从头铺而不是从当前格铺
    const from = digits.length >= length ? 0 : start
    onChange((value.slice(0, from) + digits).slice(0, length))
    focusCell(from + digits.length)
  }

  const handleChange = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, "")
    if (!digits) {
      // 这一格被清空：后面的往前挪，保证 value 始终是连续的
      onChange(value.slice(0, index) + value.slice(index + 1))
      return
    }
    if (digits.length > 1) {
      fillFrom(index, digits)
      return
    }
    onChange(value.slice(0, index) + digits + value.slice(index + 1))
    focusCell(index + 1)
  }

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      event.preventDefault()
      if (value[index]) {
        onChange(value.slice(0, index) + value.slice(index + 1))
        focusCell(index)
      } else if (index > 0) {
        onChange(value.slice(0, index - 1) + value.slice(index))
        focusCell(index - 1)
      }
      return
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault()
      focusCell(index - 1)
      return
    }
    if (event.key === "ArrowRight") {
      event.preventDefault()
      focusCell(index + 1)
    }
  }

  const handlePaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    const digits = event.clipboardData.getData("text").replace(/\D/g, "")
    if (!digits) return
    event.preventDefault()
    fillFrom(index, digits)
  }

  const surface = variant === "inset" ? "bg-[var(--surface-1)]" : "bg-[var(--surface-2)]"

  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          id={index === 0 ? id : undefined}
          ref={(el) => {
            cells.current[index] = el
          }}
          value={value[index] ?? ""}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={(e) => handlePaste(index, e)}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={t("otpDigitLabel", { label: resolvedLabel, index: index + 1 })}
          autoFocus={autoFocus && index === 0}
          disabled={disabled}
          className={`size-11 rounded-lg border text-center font-mono text-lg font-semibold text-[var(--text-primary)] transition-colors focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-60 ${surface} ${
            value[index] ? "border-[var(--border-color)]" : "border-[var(--border-subtle)]"
          }`}
        />
      ))}
    </div>
  )
}
