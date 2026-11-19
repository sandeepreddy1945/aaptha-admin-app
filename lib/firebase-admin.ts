import "server-only"

import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"

const ADMIN_APP_NAME = "aaptha-admin"

export function getFirebaseAdminApp() {
  const existingApp = getApps().find((app) => app.name === ADMIN_APP_NAME)
  if (existingApp) return existingApp

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")

  if (Boolean(clientEmail) !== Boolean(privateKey)) {
    throw new Error(
      "Set both FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY, or configure Application Default Credentials."
    )
  }

  const credential =
    clientEmail && privateKey
      ? cert({ projectId, clientEmail, privateKey })
      : applicationDefault()

  return initializeApp(
    {
      credential,
      ...(projectId ? { projectId } : {}),
    },
    ADMIN_APP_NAME
  )
}

export function getFirebaseAdminAuth() {
  return getAuth(getFirebaseAdminApp())
}
