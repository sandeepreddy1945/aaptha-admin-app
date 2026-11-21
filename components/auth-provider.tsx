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

export type RegistrationStatus = "pending" | "approved" | "rejected"

type AuthContextValue = {
  authError: string | null
  hasRequiredRole: boolean
  isAdmin: boolean
  loading: boolean
  registrationStatus: RegistrationStatus | null
  user: User | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

function isRegistrationStatus(value: unknown): value is RegistrationStatus {
  return value === "pending" || value === "approved" || value === "rejected"
}

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
  const [hasRequiredRole, setHasRequiredRole] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [registrationStatus, setRegistrationStatus] =
    useState<RegistrationStatus | null>(null)
  const pathname = usePathname()
  const router = useRouter()
  const isLoginPage = pathname === "/login"
  const isRegistrationPage = pathname === "/registration-pending"
  const isAccessDeniedPage = pathname === "/access-denied"

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
              setHasRequiredRole(false)
              setIsAdmin(false)
              setRegistrationStatus(null)
              setAuthError(null)
              void fetch("/api/auth/session", { method: "DELETE" })
                .catch(() => undefined)
                .finally(() => {
                  if (isActive) setLoading(false)
                })
              return
            }

            setLoading(true)
            setHasRequiredRole(false)
            setIsAdmin(false)
            setRegistrationStatus(null)

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

              const registrationResponse = await fetch(
                "/api/auth/registration-request",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "ensure" }),
                }
              )
              const registrationPayload: unknown = await registrationResponse
                .json()
                .catch(() => null)
              if (!registrationResponse.ok) {
                const message =
                  typeof registrationPayload === "object" &&
                  registrationPayload !== null &&
                  "error" in registrationPayload
                    ? String(registrationPayload.error)
                    : "Unable to check the account approval status."
                throw new Error(message)
              }
              if (
                typeof registrationPayload !== "object" ||
                registrationPayload === null ||
                !("status" in registrationPayload) ||
                !isRegistrationStatus(registrationPayload.status)
              ) {
                throw new Error("Unable to check the account approval status.")
              }

              if (!isActive) return
              setHasRequiredRole(
                "hasRequiredRole" in registrationPayload &&
                  registrationPayload.hasRequiredRole === true
              )
              setIsAdmin(
                "isAdmin" in registrationPayload &&
                  registrationPayload.isAdmin === true
              )
              setRegistrationStatus(registrationPayload.status)
              setUser(authenticatedUser)
              setAuthError(null)
              setLoading(false)
            } catch (error) {
              if (!isActive) return

              setUser(null)
              setHasRequiredRole(false)
              setIsAdmin(false)
              setRegistrationStatus(null)
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
            setHasRequiredRole(false)
            setIsAdmin(false)
            setRegistrationStatus(null)
            setAuthError(error.message)
            setLoading(false)
          }
        )
      })
      .catch((error: unknown) => {
        if (!isActive) return

        setUser(null)
        setHasRequiredRole(false)
        setIsAdmin(false)
        setRegistrationStatus(null)
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
      if (user) {
        router.replace(
          registrationStatus !== "approved"
            ? "/registration-pending"
            : hasRequiredRole
              ? getLoginDestination()
              : "/access-denied"
        )
      }
      return
    }

    if (!user) {
      const requestedPath = `${pathname}${window.location.search}`
      const next =
        requestedPath === "/"
          ? ""
          : `?next=${encodeURIComponent(requestedPath)}`
      router.replace(`/login${next}`)
      return
    }

    if (isRegistrationPage) {
      if (registrationStatus === "approved") {
        router.replace(hasRequiredRole ? "/dashboard" : "/access-denied")
      }
      return
    }

    if (isAccessDeniedPage) {
      if (registrationStatus !== "approved") {
        router.replace("/registration-pending")
      } else if (hasRequiredRole) {
        router.replace("/dashboard")
      }
      return
    }

    if (registrationStatus !== "approved") {
      router.replace("/registration-pending")
      return
    }

    if (!hasRequiredRole) {
      router.replace("/access-denied")
      return
    }

    if (
      (pathname === "/notifications" ||
        pathname.startsWith("/dashboard/notifications")) &&
      !isAdmin
    ) {
      router.replace("/dashboard")
    }
  }, [
    hasRequiredRole,
    isAccessDeniedPage,
    isAdmin,
    isLoginPage,
    isRegistrationPage,
    loading,
    pathname,
    registrationStatus,
    router,
    user,
  ])

  const contextValue = useMemo(
    () => ({
      authError,
      hasRequiredRole,
      isAdmin,
      loading,
      registrationStatus,
      user,
    }),
    [authError, hasRequiredRole, isAdmin, loading, registrationStatus, user]
  )
  const canRenderAuthenticatedPage = Boolean(
    user &&
    ((registrationStatus === "approved" && hasRequiredRole) ||
      isRegistrationPage ||
      isAccessDeniedPage)
  )

  return (
    <AuthContext.Provider value={contextValue}>
      {!loading && (isLoginPage || canRenderAuthenticatedPage) ? (
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
