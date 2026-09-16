"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"

/**
 * 扫码绑定的二维码卡片。
 *
 * 配色固定为「深色码点 + 白底」，不跟随主题反相：验证器 App 的识别依赖浅色静默区，
 * 深底浅点的二维码在部分机型上扫不出来，而且一整块深色方块嵌在面板里也很突兀。
 * 想让它不显得生硬，靠的是外面的圆角白卡片 + 细边框 + 轻阴影，而不是换底色。
 */
const QR_DARK = "#1f2933"
const QR_LIGHT = "#ffffff"

interface QrCodeCardProps {
  value: string
  size?: number
  className?: string
}

export function QrCodeCard({ value, size = 176, className }: QrCodeCardProps) {
  const t = useTranslations("settings")
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setFailed(false)
    QRCode.toDataURL(value, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: size * 2, // 二倍图，避免高分屏发虚
      color: { dark: QR_DARK, light: QR_LIGHT },
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
  }, [value, size])

  return (
    <div
      className={`shrink-0 rounded-2xl border border-[var(--border-subtle)] bg-white p-3 shadow-sm ${className ?? ""}`}
    >
      {/* 内层不加圆角/裁切：码点四周的浅色静默区被切掉会影响识别 */}
      <div
        className="flex items-center justify-center"
        style={{ width: size, height: size, background: QR_LIGHT }}
      >
        {failed ? (
          <span className="px-3 text-center text-xs text-[var(--text-tertiary)]">
            {t("qrFailed")}
          </span>
        ) : dataUrl ? (
          <img
            src={dataUrl}
            alt={t("qrAlt")}
            width={size}
            height={size}
            style={{ width: size, height: size, display: "block" }}
          />
        ) : (
          <Loader2 className="size-6 animate-spin text-[var(--text-tertiary)]" />
        )}
      </div>
    </div>
  )
}
