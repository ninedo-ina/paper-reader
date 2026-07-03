import createMiddleware from "next-intl/middleware"
import { routing } from "./i18n/routing"
import type { NextRequest } from "next/server"

const intlMiddleware = createMiddleware(routing)

const PROTECTED = ["/papers", "/notes", "/settings", "/history"]

export default function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  // Check if the route (without locale) is protected
  const isProtected = PROTECTED.some((p) => pathname.endsWith(p) || pathname.includes(p + "/"))

  if (isProtected) {
    const hasToken = req.cookies.has("pr_session")
    if (!hasToken) {
      const locale = pathname.split("/")[1] ?? "zh"
      const loginUrl = new URL(`/${locale}/login`, req.url)
      loginUrl.searchParams.set("redirect", pathname)
      return Response.redirect(loginUrl)
    }
  }

  return intlMiddleware(req)
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
}
