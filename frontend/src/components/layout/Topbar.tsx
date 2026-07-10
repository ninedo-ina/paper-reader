"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LangToggle } from "@/components/ui/LangToggle";
import { NotificationDropdown } from "@/components/layout/NotificationDropdown";
import { UserMenu } from "@/components/layout/UserMenu";

export function Topbar() {
  const t = useTranslations();

  return (
    <header className="h-[52px] glass-surface border-b border-[var(--border-subtle)] flex items-center px-4 select-none justify-between">
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
      <div className="flex items-center gap-1 ml-3">
        <LangToggle />
        <NotificationDropdown />
        <ThemeToggle />
        <div className="ml-1">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
