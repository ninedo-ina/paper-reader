"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import {
  BookOpen, BrainCircuit, ChevronLeft, ChevronRight,
  FileSearch, Network, Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"

const slides = [
  { icon: FileSearch, key: "discover" },
  { icon: BrainCircuit, key: "understand" },
  { icon: Network, key: "connect" },
] as const

function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d")
    if (!canvas || !context) return
    let frame = 0
    let animation = 0
    const points = Array.from({ length: 54 }, (_, index) => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0002,
      vy: (Math.random() - 0.5) * 0.0002,
      phase: index * 0.8,
    }))
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = canvas.clientWidth * ratio
      canvas.height = canvas.clientHeight * ratio
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }
    const draw = () => {
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      context.clearRect(0, 0, width, height)
      points.forEach((point) => {
        point.x += point.vx
        point.y += point.vy
        if (point.x < 0 || point.x > 1) point.vx *= -1
        if (point.y < 0 || point.y > 1) point.vy *= -1
      })
      points.forEach((point, index) => {
        points.slice(index + 1).forEach((other) => {
          const distance = Math.hypot((point.x - other.x) * width, (point.y - other.y) * height)
          if (distance < 145) {
            context.strokeStyle = `rgba(125,211,252,${0.15 * (1 - distance / 145)})`
            context.beginPath()
            context.moveTo(point.x * width, point.y * height)
            context.lineTo(other.x * width, other.y * height)
            context.stroke()
          }
        })
        context.fillStyle = "rgba(186,230,253,.8)"
        context.beginPath()
        context.arc(point.x * width, point.y * height, 2 + Math.sin(frame * 0.02 + point.phase) * 0.6, 0, Math.PI * 2)
        context.fill()
      })
      frame += 1
      animation = requestAnimationFrame(draw)
    }
    resize()
    draw()
    window.addEventListener("resize", resize)
    return () => {
      cancelAnimationFrame(animation)
      window.removeEventListener("resize", resize)
    }
  }, [])
  return <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 size-full opacity-80" />
}

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
    <section className="relative hidden min-h-[620px] overflow-hidden rounded-[28px] border border-cyan-200/15 bg-[#071525] p-10 text-white shadow-2xl lg:flex lg:flex-col">
      <ParticleField />
      <div className="relative z-10 flex items-center gap-3 text-sm font-semibold tracking-[.18em] text-cyan-100">
        <span className="grid size-10 place-items-center rounded-xl border border-cyan-200/30 bg-cyan-200/10"><BookOpen className="size-5" /></span>
        PAPERHELPER
      </div>
      <div className="relative z-10 mt-auto max-w-lg">
        <div className="mb-7 flex size-14 items-center justify-center rounded-2xl border border-cyan-200/25 bg-cyan-300/10 text-cyan-200"><Icon className="size-7" /></div>
        <p className="mb-4 text-xs font-semibold uppercase tracking-[.28em] text-cyan-200/70">{t("loginEyebrow")}</p>
        <h2 className="max-w-md text-4xl font-semibold leading-tight tracking-[-.04em]">{t(`loginSlides.${slide.key}.title`)}</h2>
        <p className="mt-5 max-w-md text-base leading-7 text-slate-300">{t(`loginSlides.${slide.key}.description`)}</p>
        <div className="mt-9 flex items-center gap-3">
          <button type="button" aria-label={t("previousSlide")} onClick={() => change(active - 1)} className="grid size-9 place-items-center rounded-full border border-white/15 hover:bg-white/10"><ChevronLeft className="size-4" /></button>
          <div className="flex gap-1.5">{slides.map((item, index) => <button key={item.key} type="button" aria-label={t("slideNumber", { number: index + 1 })} onClick={() => change(index)} className={cn("h-1.5 rounded-full transition-all", index === active ? "w-8 bg-cyan-300" : "w-1.5 bg-white/30")} />)}</div>
          <button type="button" aria-label={t("nextSlide")} onClick={() => change(active + 1)} className="grid size-9 place-items-center rounded-full border border-white/15 hover:bg-white/10"><ChevronRight className="size-4" /></button>
        </div>
      </div>
      <div className="relative z-10 mt-10 flex items-center gap-2 text-xs text-slate-400"><Sparkles className="size-3.5 text-cyan-300" /> {t("loginTagline")}</div>
    </section>
  )
}
