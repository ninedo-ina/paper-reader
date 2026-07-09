"use client"

import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
}

export function Logo({ className }: LogoProps) {
  return (
    <div className={cn("flex items-center select-none", className)}>
      <span
        className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-[6px] font-[680] text-[13px] tracking-[-0.3px] select-none"
        style={{
          color: "var(--bg-root)",
          background: "var(--text-primary)",
        }}
      >
        PaRe
      </span>
    </div>
  )
}
