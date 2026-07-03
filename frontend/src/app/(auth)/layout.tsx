export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface-1)] p-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
