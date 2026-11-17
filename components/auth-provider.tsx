"use client"

import { onIdTokenChanged, type User } from "firebase/auth"
import { usePathname, useRouter } from "next/navigation"
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { getFirebaseAuth } from "@/lib/firebase"

type AuthContextValue = {
  authError: string | null
  loading: boolean
  user: User | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

function getLoginDestination() {
  const next = new URLSearchParams(window.location.search).get("next")
  if (!next?.startsWith("/") || next.startsWith("//")) return "/"

  try {
    const destination = new URL(next, window.location.origin)
    return destination.origin === window.location.origin
      ? `${destination.pathname}${destination.search}${destination.hash}`
      : "/"
  } catch {
    return "/"
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const pathname = usePathname()
  const router = useRouter()
  const isLoginPage = pathname === "/login"

  useEffect(() => {
    let isActive = true
    let unsubscribe: (() => void) | undefined

    Promise.resolve()
      .then(() => getFirebaseAuth())
      .then((auth) => {
        if (!isActive) return

        unsubscribe = onIdTokenChanged(
          auth,
          async (authenticatedUser) => {
            if (!isActive) return

            if (!authenticatedUser) {
              setUser(null)
              setAuthError(null)
              void fetch("/api/auth/session", { method: "DELETE" })
                .catch(() => undefined)
                .finally(() => {
                  if (isActive) setLoading(false)
                })
              return
            }

            try {
              const idToken = await authenticatedUser.getIdToken()
              const response = await fetch("/api/auth/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken }),
              })

              if (!response.ok) {
                const payload: unknown = await response.json().catch(() => null)
                const message =
                  typeof payload === "object" &&
                  payload !== null &&
                  "error" in payload
                    ? String(payload.error)
                    : "Unable to establish a secure session."
                throw new Error(message)
              }

              if (!isActive) return
              setUser(authenticatedUser)
              setAuthError(null)
              setLoading(false)
            } catch (error) {
              if (!isActive) return

              setUser(null)
              setAuthError(
                error instanceof Error
                  ? error.message
                  : "Unable to establish a secure session."
              )
              setLoading(false)
            }
          },
          (error: Error) => {
            setUser(null)
            setAuthError(error.message)
            setLoading(false)
          }
        )
      })
      .catch((error: unknown) => {
        if (!isActive) return

        setUser(null)
        setAuthError(
          error instanceof Error
            ? error.message
            : "Firebase authentication is unavailable."
        )
        setLoading(false)
      })

    return () => {
      isActive = false
      unsubscribe?.()
    }
  }, [])

  useEffect(() => {
    if (loading) return

    if (isLoginPage) {
      if (user) router.replace(getLoginDestination())
      return
    }

    if (!user) {
      const requestedPath = `${pathname}${window.location.search}`
      const next =
        requestedPath === "/"
          ? ""
          : `?next=${encodeURIComponent(requestedPath)}`
      router.replace(`/login${next}`)
    }
  }, [isLoginPage, loading, pathname, router, user])

  const contextValue = useMemo(
    () => ({ authError, loading, user }),
    [authError, loading, user]
  )

  return (
    <AuthContext.Provider value={contextValue}>
      {!loading && (isLoginPage || user) ? (
        children
      ) : (
        <div
          className="flex min-h-svh items-center justify-center text-sm text-muted-foreground"
          role="status"
        >
          Checking authentication…
        </div>
      )}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.")
  }

  return context
}
