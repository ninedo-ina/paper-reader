import dynamic from "next/dynamic"
import { runtimeTranslator } from "@/i18n/runtime"

export const PaperEditor = dynamic(
  () => import("./PaperEditor").then((m) => ({ default: m.PaperEditor })),
  // loading 回调在渲染时才执行，届时根布局已注册好当前语言的消息，可以放心取文案。
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full text-sm text-[var(--text-tertiary)]">{runtimeTranslator("common")("loadingEditor")}</div> },
)
