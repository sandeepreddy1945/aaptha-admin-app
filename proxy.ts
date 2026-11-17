import { NextResponse, type NextRequest } from "next/server"

import { FIREBASE_SESSION_COOKIE } from "@/lib/auth-constants"
import { getFirebaseAdminAuth } from "@/lib/firebase-admin"

const LOGIN_PATH = "/login"
const SESSION_API_PATH = "/api/auth/session"

function clearSessionCookie(response: NextResponse) {
  response.cookies.set(FIREBASE_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })

  return response
}

function getSafeLocalPath(path: string | null, baseUrl: string) {
  if (!path?.startsWith("/") || path.startsWith("//")) return "/"

  try {
    const target = new URL(path, baseUrl)
    return target.origin === new URL(baseUrl).origin
      ? `${target.pathname}${target.search}${target.hash}`
      : "/"
  } catch {
    return "/"
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname === SESSION_API_PATH) {
    return NextResponse.next()
  }

  const sessionCookie = request.cookies.get(FIREBASE_SESSION_COOKIE)?.value
  let isAuthenticated = false

  if (sessionCookie) {
    try {
      await getFirebaseAdminAuth().verifySessionCookie(sessionCookie)
      isAuthenticated = true
    } catch {
      isAuthenticated = false
    }
  }

  if (pathname === LOGIN_PATH) {
    if (!isAuthenticated) return NextResponse.next()

    const next = request.nextUrl.searchParams.get("next")
    return NextResponse.redirect(
      new URL(getSafeLocalPath(next, request.url), request.url)
    )
  }

  if (isAuthenticated) return NextResponse.next()

  if (pathname.startsWith("/api/")) {
    return clearSessionCookie(
      NextResponse.json({ error: "Authentication required." }, { status: 401 })
    )
  }

  const loginUrl = new URL(LOGIN_PATH, request.url)
  const requestedPath = `${pathname}${request.nextUrl.search}`
  if (pathname !== "/") loginUrl.searchParams.set("next", requestedPath)

  return clearSessionCookie(NextResponse.redirect(loginUrl))
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
