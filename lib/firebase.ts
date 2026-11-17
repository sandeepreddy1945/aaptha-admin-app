import { getApp, getApps, initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"

function getFirebaseConfig() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  }

  const requiredConfig = [
    ["NEXT_PUBLIC_FIREBASE_API_KEY", config.apiKey],
    ["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", config.authDomain],
    ["NEXT_PUBLIC_FIREBASE_PROJECT_ID", config.projectId],
    ["NEXT_PUBLIC_FIREBASE_APP_ID", config.appId],
  ] as const
  const missingConfig = requiredConfig
    .filter(([, value]) => !value)
    .map(([name]) => name)

  if (missingConfig.length > 0) {
    throw new Error(
      `Missing Firebase configuration: ${missingConfig.join(", ")}. Add these values to your .env.local file.`
    )
  }

  return config
}

export function getFirebaseAuth() {
  const app =
    getApps().length > 0 ? getApp() : initializeApp(getFirebaseConfig())
  return getAuth(app)
}
