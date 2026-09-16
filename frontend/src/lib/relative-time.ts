/** Translator shape accepted by {@link formatRelativeTime}. */
export type TimeTranslator = (
  key: "justNow" | "minutesAgo" | "hoursAgo" | "daysAgo",
  values?: Record<string, number>,
) => string

/**
 * Formats an ISO timestamp as a localized relative time ("3 minutes ago").
 * Falls back to a locale-aware absolute date once the gap exceeds 30 days.
 */
export function formatRelativeTime(iso: string, t: TimeTranslator, locale: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "--"
  const minutes = Math.floor((Date.now() - d.getTime()) / 60000)
  if (minutes < 1) return t("justNow")
  if (minutes < 60) return t("minutesAgo", { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t("hoursAgo", { count: hours })
  const days = Math.floor(hours / 24)
  if (days < 30) return t("daysAgo", { count: days })
  return d.toLocaleDateString(locale)
}
