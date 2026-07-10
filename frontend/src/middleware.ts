/**
 * Next.js 中间件 / Middleware
 *
 * 职责 / Responsibilities:
 * 1. 国际化路由（next-intl）/ i18n routing via next-intl
 * 2. 认证守卫：未登录重定向到登录页 / Auth guard: redirect unauthenticated users to login
 * 3. GitHub OAuth 回调放行（无 locale 前缀）/ Allow GitHub OAuth callback without locale prefix
 */

import { NextResponse } from "next/server"
import createMiddleware from "next-intl/middleware"
import { routing } from "./i18n/routing"
import type { NextRequest } from "next/server"

const intlMiddleware = createMiddleware(routing)

/** 无需登录即可访问的路径 / Paths accessible without authentication */
const PUBLIC = ["/login"]

export default function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  // /callback 绕过 intlMiddleware，避免 next-intl 自动添加 locale 前缀
  // Bypass intlMiddleware to prevent auto locale-prefix redirect
  if (pathname === "/callback" || pathname.startsWith("/callback?")) {
    return NextResponse.next()
  }

  // 公开路径交给 next-intl 处理 / Public paths handled by next-intl
  const isPublic = PUBLIC.some((p) => pathname.endsWith(p) || pathname.includes(p + "/"))
  if (isPublic) return intlMiddleware(req)

  // 检查 session cookie，无 cookie 则重定向到登录 / Check session cookie, redirect if missing
  const hasToken = req.cookies.has("pr_session")
  if (!hasToken) {
    const locale = pathname.split("/")[1] ?? "zh"
    const loginUrl = new URL(`/${locale}/login`, req.url)
    loginUrl.searchParams.set("redirect", pathname)
    return Response.redirect(loginUrl)
  }

  // 已登录，正常走 intlMiddleware / Authenticated, proceed with intl
  return intlMiddleware(req)
}

/** 匹配所有非静态/非 API 路径 / Match all non-static, non-API paths */
export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
}
