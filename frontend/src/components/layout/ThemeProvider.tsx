"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ReactNode } from "react";
import { FaviconThemeSync } from "@/components/layout/FaviconThemeSync";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <FaviconThemeSync />
      {children}
    </NextThemesProvider>
  );
}
