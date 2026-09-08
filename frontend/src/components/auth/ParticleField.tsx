"use client"

import { useEffect, useRef } from "react"

export function ParticleField() {
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
    const readAccentRgb = () => {
      const style = getComputedStyle(canvas)
      const accent = style.getPropertyValue("--accent").trim()
      const probe = document.createElement("span")
      probe.style.color = accent || "#1a1a1a"
      document.body.appendChild(probe)
      const rgb = getComputedStyle(probe).color
      document.body.removeChild(probe)
      const match = rgb.match(/\d+/g)
      return match ? match.slice(0, 3).join(",") : "26,26,26"
    }
    let accentRgb = readAccentRgb()
    const observer = new MutationObserver(() => { accentRgb = readAccentRgb() })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })
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
            context.strokeStyle = `rgba(${accentRgb},${0.18 * (1 - distance / 145)})`
            context.beginPath()
            context.moveTo(point.x * width, point.y * height)
            context.lineTo(other.x * width, other.y * height)
            context.stroke()
          }
        })
        context.fillStyle = `rgba(${accentRgb},.55)`
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
      observer.disconnect()
    }
  }, [])
  return <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 size-full opacity-40" />
}
