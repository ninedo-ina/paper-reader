import { LoginExperience } from "@/components/auth/LoginExperience"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#eef4f8] p-4 text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl items-center gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(380px,.8fr)]">
        <LoginExperience />
        <div className="flex w-full justify-center">{children}</div>
      </div>
    </main>
  )
}
