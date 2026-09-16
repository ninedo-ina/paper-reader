import { BookOpen } from "lucide-react"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher"
import { ParticleField } from "@/components/auth/ParticleField"
import { LoginExperience } from "@/components/auth/LoginExperience"
import { AuthFooter } from "@/components/auth/AuthFooter"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen flex-col bg-[var(--bg-root)] p-4 text-[var(--text-primary)] sm:p-6 lg:p-8">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,var(--bg-root),var(--surface-0))] opacity-90" />
        <ParticleField />
      </div>
      {/* z-30 keeps the header (and the language dropdown hanging out of it) above the
          sign-in row below, which is a later sibling with the same z-10: equal z-index
          means the later one wins, so the dropdown used to be covered by the form card
          and its options could not be clicked. */}
      <div className="relative z-30 mx-auto flex w-full max-w-7xl items-center justify-between gap-1">
        <div className="flex items-center gap-3 text-sm font-semibold tracking-[.18em] text-[var(--accent)]">
          <span className="grid size-10 place-items-center rounded-xl border border-[var(--border-color)] bg-[var(--accent-soft)]"><BookOpen className="size-5" /></span>
          PAPERHELPER
        </div>
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
      {/* The header and footer keep their own heights; the sign-in row takes whatever is
          left and centres the showcase + form inside it. Before this the row sat directly
          under the header with all the slack pushed to the footer, so on a tall monitor
          the card hugged the top and the page looked bottom-heavy. */}
      <div className="relative z-10 flex w-full flex-1 items-center py-6">
        <div className="mx-auto grid w-full max-w-7xl items-stretch gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(380px,.8fr)]">
          <LoginExperience />
          <div className="flex w-full items-center justify-center">{children}</div>
        </div>
      </div>
      <div className="relative z-10 mt-auto"><AuthFooter /></div>
    </main>
  )
}