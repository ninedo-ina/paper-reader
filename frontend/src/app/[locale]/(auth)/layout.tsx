import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { LangToggle } from "@/components/ui/LangToggle"
import { LoginExperience } from "@/components/auth/LoginExperience"
import { AuthFooter } from "@/components/auth/AuthFooter"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col bg-[var(--bg-root)] p-4 text-[var(--text-primary)] sm:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-end gap-1">
        <LangToggle />
        <ThemeToggle />
      </div>
      <div className="mx-auto grid w-full max-w-7xl flex-1 items-stretch gap-6 py-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(380px,.8fr)]">
        <LoginExperience />
        <div className="flex w-full items-center justify-center">{children}</div>
      </div>
      <AuthFooter />
    </main>
  )
}
