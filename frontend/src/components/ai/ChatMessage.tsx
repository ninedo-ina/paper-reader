"use client"

import { cn } from "@/lib/utils"
import type { AiMessageDto } from "@/lib/api/types"
import { Bot, User } from "lucide-react"

interface ChatMessageProps {
  message: AiMessageDto
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user"

  return (
    <div className={cn("flex gap-2 px-3 py-2", isUser && "justify-end")}>
      {!isUser && (
        <div className="size-6 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="size-3.5 text-[var(--surface-0)]" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-3 py-2 text-sm",
          isUser
            ? "bg-[var(--accent)] text-[var(--surface-0)]"
            : "bg-[var(--surface-2)] text-[var(--text-primary)]",
        )}
      >
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
      </div>
      {isUser && (
        <div className="size-6 rounded-full bg-[var(--surface-2)] flex items-center justify-center shrink-0 mt-0.5">
          <User className="size-3.5 text-[var(--text-secondary)]" />
        </div>
      )}
    </div>
  )
}
