"use client"

import { useEffect } from "react"
import { useTranslations } from "next-intl"
import { useAuthStore } from "@/stores/auth-store"
import { useNotificationStore } from "@/stores/notification-store"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Sparkles, FileText, MessageCircle, Bell, PenTool, Github } from "lucide-react"

const features = [
  { icon: FileText, key: "upload" },
  { icon: PenTool, key: "annotate" },
  { icon: MessageCircle, key: "aiChat" },
  { icon: Bell, key: "notify" },
  { icon: Github, key: "github" },
]

export function VersionPopup() {
  const t = useTranslations("version")
  const isNewUser = useAuthStore((s) => s.isNewUser)
  const consumeNewUserFlag = useAuthStore((s) => s.consumeNewUserFlag)
  const showVersionPopup = useNotificationStore((s) => s.showVersionPopup)
  const setShowVersionPopup = useNotificationStore((s) => s.setShowVersionPopup)

  const visible = isNewUser === true || showVersionPopup

  useEffect(() => {
    if (visible) {
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = ""
      }
    }
  }, [visible])

  if (!visible) return null

  const handleClose = () => {
    if (isNewUser) consumeNewUserFlag()
    setShowVersionPopup(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card variant="glass" className="w-full max-w-lg mx-4 shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-[var(--accent)]/10">
            <Sparkles className="size-6 text-[var(--accent)]" />
          </div>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3">
            {features.map(({ icon: Icon, key }) => (
              <div
                key={key}
                className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] p-3"
              >
                <div className="flex size-9 items-center justify-center rounded-md bg-[var(--surface-2)]">
                  <Icon className="size-4 text-[var(--accent)]" />
                </div>
                <div>
                  <p className="text-sm font-medium">{t(`features.${key}.title`)}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {t(`features.${key}.desc`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="justify-center">
          <Button onClick={handleClose} size="lg">
            {t("gotIt")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
