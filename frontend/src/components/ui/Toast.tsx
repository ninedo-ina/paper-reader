"use client"

import { createPortal } from "react-dom"
import { useToastStore } from "@/stores/toast-store"
import { X, CheckCircle, AlertCircle, Info } from "lucide-react"

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
}

const colorMap = {
  success: "border-green-500/30 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300",
  error: "border-red-500/30 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
  info: "border-blue-500/30 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return createPortal(
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((toast) => {
        const Icon = iconMap[toast.type || "success"]
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-lg border shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-2 ${colorMap[toast.type || "success"]}`}
          >
            <Icon className="size-4 shrink-0" />
            <span>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-1 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )
      })}
    </div>,
    document.body
  )
}
