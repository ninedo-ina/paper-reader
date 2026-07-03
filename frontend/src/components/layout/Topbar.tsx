"use client";

import { Search, BookOpen } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LangToggle } from "@/components/ui/LangToggle";
import { useTranslations } from "next-intl";

export function Topbar() {
  const t = useTranslations();

  return (
    <header className="h-[52px] glass-surface border-b border-[var(--border-subtle)] flex items-center px-4 gap-3 select-none z-50">
      <div className="flex items-center gap-2 mr-4">
        <span
          className="inline-block w-[7px] h-[7px] rounded-full mr-1"
          style={{ background: "var(--text-primary)" }}
        />
        <span className="font-[680] text-[15px] tracking-[-0.3px] text-[var(--text-primary)]">
          {t("app.name")}
        </span>
      </div>

      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
          <input
            type="text"
            placeholder={t("reader.search")}
            className="w-full h-8 pl-9 pr-3 rounded-lg text-sm bg-[var(--surface-2)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:ring-2 focus:ring-[var(--accent)]/20 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-1">
        <LangToggle />
        <ThemeToggle />
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ml-2 cursor-pointer"
          style={{ background: "var(--text-primary)", color: "var(--bg-root, #eeeff2)" }}
          title="用户"
        >
          Y
        </div>
      </div>
    </header>
  );
}
