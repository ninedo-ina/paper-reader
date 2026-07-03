"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Send, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/Button"

interface ChatInputProps {
  onSend: (message: string) => Promise<void>
  isSending: boolean
  paperTitle?: string
}

const PRESETS = ["summarize", "explain", "translate"] as const

export function ChatInput({ onSend, isSending, paperTitle }: ChatInputProps) {
  const t = useTranslations("ai")
  const [input, setInput] = useState("")
  const ref = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || isSending) return
    setInput("")
    await onSend(trimmed)
  }, [input, isSending, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  useEffect(() => { ref.current?.focus() }, [])

  return (
    <div className="border-t border-[var(--border-color)] bg-[var(--surface-0)]">
      {/* Preset buttons */}
      <div className="flex gap-1 px-3 pt-2">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setInput((v) => (v ? `${v} ` : "") + t(preset))}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-[var(--text-tertiary)] border border-[var(--border-color)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-all"
          >
            <Sparkles className="size-2.5" />
            {t(preset)}
          </button>
        ))}
      </div>

      <div className="flex items-end gap-2 p-3">
        <textarea
          ref={ref}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={paperTitle ? `${t("placeholder")} (${paperTitle})` : t("placeholder")}
          rows={1}
          className="flex-1 bg-[var(--surface-1)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none focus:ring-1 focus:ring-[var(--accent)]"
        />
        <Button size="sm" onClick={handleSend} disabled={!input.trim() || isSending}>
          {isSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
    </div>
  )
}
