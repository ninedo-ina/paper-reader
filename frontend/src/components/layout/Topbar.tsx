"use client";

import { useTranslations } from "next-intl";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LangToggle } from "@/components/ui/LangToggle";
import { NotificationDropdown } from "@/components/layout/NotificationDropdown";
import { SearchDialog } from "@/components/layout/SearchDialog";
import { UserMenu } from "@/components/layout/UserMenu";

export function Topbar() {
  const t = useTranslations();

  return (
    <header className="h-[52px] glass-surface border-b border-[var(--border-subtle)] flex items-center px-4 select-none justify-between relative z-10">
      <div className="flex-1" />
      <div className="flex items-center gap-1 ml-3">
        <SearchDialog />
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
