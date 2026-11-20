"use client"

import { ShieldAlertIcon } from "lucide-react"
import { useState } from "react"
import { signOut } from "firebase/auth"

import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { getFirebaseAuth } from "@/lib/firebase"

export default function AccessDeniedPage() {
  const { user } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleSignOut() {
    setIsSigningOut(true)
    setError(null)

    try {
      await signOut(getFirebaseAuth())
    } catch {
      setError("Unable to sign out. Please try again.")
      setIsSigningOut(false)
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <section className="w-full max-w-lg space-y-6 rounded-xl border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlertIcon aria-hidden="true" className="size-6" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Access not permitted</h1>
          <p className="text-sm text-muted-foreground">
            Your account doesn’t have the necessary permissions to use this application. Contact an administrator if you believe this is a mistake.
          </p>
          {user?.email && <p className="text-sm font-medium">{user.email}</p>}
        </div>
        <Button disabled={isSigningOut} onClick={() => void handleSignOut()} type="button">
          {isSigningOut ? "Signing out…" : "Sign out"}
        </Button>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  )
}
