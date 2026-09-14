"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import QRCode from "qrcode"
import { Loader2 } from "lucide-react"

/**
 * 二维码配色跟随当前主题：白天用深色码点 + 白底，夜间反相成浅色码点 + 深底。
 * 两种配色都保持足够对比度，避免在任一主题下扫不出来。
 */
const PALETTE = {
  light: { dark: "#1f2933", light: "#ffffff" },
  dark: { dark: "#e8eef5", light: "#101823" },
} as const

interface ThemeAwareQrCodeProps {
  value: string
  size?: number
  className?: string
}

export function ThemeAwareQrCode({ value, size = 176, className }: ThemeAwareQrCodeProps) {
  const { resolvedTheme } = useTheme()
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  const isDark = resolvedTheme === "dark"
  const palette = isDark ? PALETTE.dark : PALETTE.light

  useEffect(() => {
    let cancelled = false
    setFailed(false)
    QRCode.toDataURL(value, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: size * 2, // 二倍图，避免高分屏发虚
      color: { dark: palette.dark, light: palette.light },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) {
          setDataUrl(null)
          setFailed(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [value, size, palette.dark, palette.light])

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        background: palette.light,
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {failed ? (
        <span className="px-3 text-center text-xs text-[var(--text-tertiary)]">
          二维码生成失败，请使用下方密钥手动添加
        </span>
      ) : dataUrl ? (
        <img
          src={dataUrl}
          alt="两步验证二维码"
          width={size}
          height={size}
          style={{ width: size, height: size, display: "block" }}
        />
      ) : (
        <Loader2 className="size-6 animate-spin text-[var(--text-tertiary)]" />
      )}
    </div>
  )
}
