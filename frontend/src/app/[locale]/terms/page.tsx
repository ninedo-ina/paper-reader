import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

export default async function TermsPage() {
  const t = await getTranslations("legal")

  return (
    <main className="min-h-screen bg-[var(--bg-root)] px-4 py-10 text-[var(--text-primary)] sm:px-8">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/login"
          className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="size-4" />
          {t("back")}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{t("terms.title")}</h1>
        <p className="mt-2 text-sm text-[var(--text-tertiary)]">{t("terms.updatedAt")}</p>
        <p className="mt-6 text-sm leading-7 text-[var(--text-secondary)]">{t("terms.body")}</p>
      </div>
    </main>
  )
}
