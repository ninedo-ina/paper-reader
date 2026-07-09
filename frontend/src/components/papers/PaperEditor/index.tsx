import dynamic from "next/dynamic"

export const PaperEditor = dynamic(
  () => import("./PaperEditor").then((m) => ({ default: m.PaperEditor })),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full text-sm text-[var(--text-tertiary)]">Loading editor...</div> },
)
