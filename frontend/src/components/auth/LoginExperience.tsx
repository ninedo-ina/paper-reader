"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import {
  BrainCircuit, ChevronLeft, ChevronRight,
  FileSearch, Network, Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"

const slides = [
  { icon: FileSearch, key: "discover" },
  { icon: BrainCircuit, key: "understand" },
  { icon: Network, key: "connect" },
] as const

export function LoginExperience() {
  const t = useTranslations("auth")
  const [active, setActive] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const resetTimer = () => {
    if (timer.current) clearInterval(timer.current)
    timer.current = setInterval(() => setActive((value) => (value + 1) % slides.length), 6000)
  }
  useEffect(() => {
    resetTimer()
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [])
  const slide = slides[active]
  const Icon = slide.icon
  const change = (next: number) => {
    setActive((next + slides.length) % slides.length)
    resetTimer()
  }
  return (
    <section className="relative hidden lg:flex lg:flex-col">
      <div className="mt-auto max-w-lg">
        <div className="mb-7 flex size-14 items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--accent-soft)] text-[var(--accent)]"><Icon className="size-7" /></div>
        <p className="mb-4 text-xs font-semibold uppercase tracking-[.28em] text-[var(--text-tertiary)]">{t("loginEyebrow")}</p>
        <h2 className="max-w-md text-4xl font-semibold leading-tight tracking-[-.04em] text-[var(--text-primary)]">{t(`loginSlides.${slide.key}.title`)}</h2>
        <p className="mt-5 max-w-md text-base leading-7 text-[var(--text-secondary)]">{t(`loginSlides.${slide.key}.description`)}</p>
        <div className="mt-9 flex items-center gap-3">
          <button type="button" aria-label={t("previousSlide")} onClick={() => change(active - 1)} className="grid size-9 place-items-center rounded-full border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"><ChevronLeft className="size-4" /></button>
          <div className="flex gap-1.5">{slides.map((item, index) => <button key={item.key} type="button" aria-label={t("slideNumber", { number: index + 1 })} onClick={() => change(index)} className={cn("h-1.5 rounded-full transition-all", index === active ? "w-8 bg-[var(--accent)]" : "w-1.5 bg-[var(--border-color)]")} />)}</div>
          <button type="button" aria-label={t("nextSlide")} onClick={() => change(active + 1)} className="grid size-9 place-items-center rounded-full border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"><ChevronRight className="size-4" /></button>
        </div>
      </div>
      <div className="mt-10 flex items-center gap-2 text-xs text-[var(--text-tertiary)]"><Sparkles className="size-3.5 text-[var(--accent)]" /> {t("loginTagline")}</div>
    </section>
  )
}
