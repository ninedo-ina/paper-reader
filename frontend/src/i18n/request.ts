import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isAppLocale } from './locales';

/**
 * 没有语言前缀的路径（如 /callback）拿不到 requestLocale —— next-intl 中间件被刻意绕开了，
 * 只会回落成默认语言：那边的 `<html lang/dir>` 和文案会永远停在简体中文。
 * 这里补一次 Cookie 兜底，让这些页面也跟着用户选过的语言走。
 */
async function localeFromCookie(): Promise<string | undefined> {
  try {
    return (await cookies()).get(LOCALE_COOKIE)?.value;
  } catch {
    // 静态渲染等场景下读不到 Cookie，交给默认语言
    return undefined;
  }
}

/**
 * 深合并：以默认语言（简体中文）为底，用当前语言的文案覆盖。
 * 某个语言包漏了 key 时，页面回落成中文而不是直接暴露 key 路径。
 */
function mergeMessages(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const previous = merged[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      previous &&
      typeof previous === 'object' &&
      !Array.isArray(previous)
    ) {
      merged[key] = mergeMessages(
        previous as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const cookieLocale = isAppLocale(requested) ? undefined : await localeFromCookie();
  const locale = isAppLocale(requested)
    ? requested
    : isAppLocale(cookieLocale)
      ? cookieLocale
      : routing.defaultLocale;

  const messages = (await import(`./locales/${locale}/common.json`)).default;

  return {
    locale,
    messages:
      locale === DEFAULT_LOCALE
        ? messages
        : mergeMessages(
            (await import(`./locales/${DEFAULT_LOCALE}/common.json`)).default,
            messages,
          ),
  };
});
