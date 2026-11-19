"use client"

import { initializeUI } from "@firebase-oss/ui-core"
import { FirebaseUIProvider } from "@firebase-oss/ui-react"
import { useEffect, useState, type ReactNode } from "react"

import { getFirebaseApp } from "@/lib/firebase"

type FirebaseUIInstance = ReturnType<typeof initializeUI>

let firebaseUIInstance: FirebaseUIInstance | null = null

export function FirebaseUIRootProvider({ children }: { children: ReactNode }) {
  const [ui, setUI] = useState<FirebaseUIInstance | null>(firebaseUIInstance)

  useEffect(() => {
    let isActive = true

    Promise.resolve()
      .then(() => {
        firebaseUIInstance ??= initializeUI({ app: getFirebaseApp() })
        return firebaseUIInstance
      })
      .then((instance) => {
        if (isActive) setUI(instance)
      })
      .catch((error: unknown) => {
        console.error("Firebase UI initialization failed.", error)
      })

    return () => {
      isActive = false
    }
  }, [])

  return ui ? (
    <FirebaseUIProvider ui={ui}>{children}</FirebaseUIProvider>
  ) : (
    children
  )
}
