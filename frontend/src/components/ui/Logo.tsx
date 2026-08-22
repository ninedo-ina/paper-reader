"use client"

import { cn } from "@/lib/utils"
import packageJson from "../../../package.json"

interface LogoProps {
  className?: string
}

export function PaperReadMark({ className }: LogoProps) {
  return (
    <span
      aria-label="PaperReader"
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-[9px] border border-[var(--border-color)]",
        "bg-[var(--text-primary)] text-[var(--bg-root)] text-[17px] font-[800] leading-none tracking-[-0.02em]",
        "select-none",
        className,
      )}
    >
      R
    </span>
  )
}

export function PaperReadBrand({ className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2 select-none", className)}>
      <PaperReadMark />
      <div className="flex h-8 min-w-0 flex-col justify-center leading-none">
        <span className="text-[14px] font-[680] tracking-[-0.2px] text-[var(--text-primary)]">
          PaperReader
        </span>
        <span className="mt-1 text-[10px] font-medium tracking-[0.02em] text-[var(--text-tertiary)]">
          v{packageJson.version}
        </span>
      </div>
    </div>
  )
}

export function Logo({ className }: LogoProps) {
  return <PaperReadBrand className={className} />
}
