"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import packageJson from "../../../package.json"

export function AuthFooter() {
  const t = useTranslations("auth")
  const year = new Date().getFullYear()

  return (
    <footer className="mx-auto mt-6 flex w-full max-w-7xl flex-col items-center gap-1 pb-2 text-center text-xs text-[var(--text-tertiary)]">
      <p>
        {t("copyright", { year })} · v{packageJson.version}
      </p>
      <p>
        <Link href="/terms" className="hover:text-[var(--text-secondary)] hover:underline">
          {t("termsLink")}
        </Link>
        <span className="mx-2">·</span>
        <Link href="/privacy" className="hover:text-[var(--text-secondary)] hover:underline">
          {t("privacyLink")}
        </Link>
      </p>
    </footer>
  )
}
