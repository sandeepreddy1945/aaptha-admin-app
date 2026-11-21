import "server-only"

import type { NextRequest } from "next/server"
import { getFirestore } from "firebase-admin/firestore"

import { FIREBASE_SESSION_COOKIE } from "@/lib/auth-constants"
import { getFirebaseAdminApp, getFirebaseAdminAuth } from "@/lib/firebase-admin"
import { getUserProfileDocument } from "@/lib/user-profile"

export type RegistrationStatus = "pending" | "approved" | "rejected"

export type AccountAccess = {
  hasRequiredRole: boolean
  isAdmin: boolean
  isHr: boolean
  roles: string[]
  status: RegistrationStatus
}

export function parseUserRoles(value: unknown) {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : []

  return [
    ...new Set(
      values
        .filter((role): role is string => typeof role === "string")
        .map((role) => role.trim().toLowerCase())
        .filter(Boolean)
    ),
  ]
}

export async function getSessionUid(request: NextRequest) {
  const sessionCookie = request.cookies.get(FIREBASE_SESSION_COOKIE)?.value
  if (!sessionCookie) return null

  try {
    const session = await getFirebaseAdminAuth().verifySessionCookie(
      sessionCookie,
      true
    )
    return session.uid
  } catch {
    return null
  }
}

export async function getAccountAccess(uid: string): Promise<AccountAccess> {
  const database = getFirestore(getFirebaseAdminApp())
  const [requestSnapshot, profileSnapshot] = await Promise.all([
    database.collection("registrationRequests").doc(uid).get(),
    getUserProfileDocument(uid).then(({ ref }) => ref.get()),
  ])

  const profile = profileSnapshot.data()
  const roleValue = profile?.role !== undefined ? profile.role : profile?.roles
  const roles = parseUserRoles(roleValue)
  const isAdmin = roles.includes("admin")
  const isHr = roles.includes("hr")
  const requestStatus = requestSnapshot.data()?.status
  const profileStatus = profile?.accountStatus
  const status =
    requestStatus === "pending" ||
    requestStatus === "approved" ||
    requestStatus === "rejected"
      ? requestStatus
      : profileStatus === "pending" ||
          profileStatus === "approved" ||
          profileStatus === "rejected"
        ? profileStatus
        : profileSnapshot.exists
          ? "approved"
          : "pending"

  return {
    hasRequiredRole: isAdmin || isHr,
    isAdmin,
    isHr,
    roles,
    status,
  }
}

export async function getAdminSessionUid(request: NextRequest) {
  const uid = await getSessionUid(request)
  if (!uid) return null

  const access = await getAccountAccess(uid)
  return access.isAdmin && access.status === "approved" ? uid : null
}

export async function getApprovedSessionUid(request: NextRequest) {
  const uid = await getSessionUid(request)
  if (!uid) return null

  const access = await getAccountAccess(uid)
  return access.hasRequiredRole && access.status === "approved" ? uid : null
}
