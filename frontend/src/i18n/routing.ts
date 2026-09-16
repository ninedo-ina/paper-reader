import { defineRouting } from 'next-intl/routing';
import { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE } from './locales';

export const routing = defineRouting({
  locales: [...LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  // 语言选择记在 Cookie 里：登录页选的语言，登录后会带到应用内部（详见 locales.ts）
  localeCookie: {
    name: LOCALE_COOKIE,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  },
});
