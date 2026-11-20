"use client"

import { LoaderCircleIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"
import { useRemoteConfig } from "@/components/remote-config-provider"

export default function RegistrationPendingPage() {
  const { registrationStatus, user } = useAuth()
  const { organizationFullName } = useRemoteConfig()
  const [status, setStatus] = useState(registrationStatus)
  const [isReapplying, setIsReapplying] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isRejected = status === "rejected"

  const requestAnotherReview = async () => {
    setIsReapplying(true)
    setError(null)

    try {
      const response = await fetch("/api/auth/registration-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reapply" }),
      })
      const payload: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const message =
          typeof payload === "object" && payload !== null && "error" in payload
            ? String(payload.error)
            : "Unable to resubmit your request."
        throw new Error(message)
      }

      if (
        typeof payload !== "object" ||
        payload === null ||
        !("status" in payload) ||
        payload.status !== "pending"
      ) {
        throw new Error("The access request response was invalid.")
      }
      setStatus("pending")
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to resubmit your request.",
      )
    } finally {
      setIsReapplying(false)
    }
  }

  const checkApprovalStatus = async () => {
    setIsChecking(true)
    setError(null)

    try {
      const response = await fetch("/api/auth/registration-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ensure" }),
      })
      const payload: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const message =
          typeof payload === "object" && payload !== null && "error" in payload
            ? String(payload.error)
            : "Unable to check your approval status."
        throw new Error(message)
      }
      if (
        typeof payload !== "object" ||
        payload === null ||
        !("status" in payload) ||
        (payload.status !== "pending" &&
          payload.status !== "approved" &&
          payload.status !== "rejected")
      ) {
        throw new Error("The approval status response was invalid.")
      }

      if (payload.status === "approved") {
        window.location.assign(
          "hasRequiredRole" in payload && payload.hasRequiredRole === true
            ? "/dashboard"
            : "/access-denied",
        )
        return
      }
      setStatus(payload.status)
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "Unable to check your approval status.",
      )
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <section className="w-full max-w-lg space-y-6 rounded-xl border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <span aria-hidden="true" className="text-xl">✓</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">{organizationFullName} access</h1>
          <p className="text-sm text-muted-foreground">
            {isRejected
              ? "Your request was declined. You can ask the administrator to review it again."
              : status === "pending"
                ? "Your request is awaiting administrator approval. We’ll let you know when access is approved."
                : "Checking your access request…"}
          </p>
          {user?.email && (
            <p className="text-sm font-medium" dir="auto">
              {user.email}
            </p>
          )}
        </div>
        {isRejected ? (
          <Button
            disabled={isReapplying}
            onClick={() => void requestAnotherReview()}
            type="button"
          >
            {isReapplying ? "Resubmitting…" : "Request another review"}
          </Button>
        ) : (
          <Button
            disabled={isChecking}
            onClick={() => void checkApprovalStatus()}
            type="button"
            variant="outline"
          >
            {isChecking && <LoaderCircleIcon className="animate-spin" />}
            Check approval status
          </Button>
        )}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  )
}
