import "server-only"

import type { UserRecord } from "firebase-admin/auth"
import {
  FieldValue,
  getFirestore,
  type DocumentReference,
} from "firebase-admin/firestore"

import { getFirebaseAdminApp, getFirebaseAdminAuth } from "@/lib/firebase-admin"

export function normalizeEmailId(email: string) {
  return email.trim().toLowerCase()
}

export async function getUserProfileDocument(uid: string) {
  const authUser = await getFirebaseAdminAuth().getUser(uid)
  return getOrMigrateUserProfileDocument(authUser)
}

export async function getOrMigrateUserProfileDocument(
  authUser: UserRecord
): Promise<{
  emailId: string
  ref: DocumentReference
}> {
  const email = authUser.email?.trim()
  if (!email) {
    throw new Error("A Firebase email address is required for a user profile.")
  }

  const emailId = normalizeEmailId(email)
  const database = getFirestore(getFirebaseAdminApp())
  const users = database.collection("users")
  const profileRef = users.doc(emailId)
  const legacyUidRef = users.doc(authUser.uid)

  if (profileRef.path === legacyUidRef.path) {
    return { emailId, ref: profileRef }
  }

  const identity = {
    uid: authUser.uid,
    emailId,
    email,
    displayName: authUser.displayName ?? "",
    emailVerified: authUser.emailVerified,
    phoneNumber: authUser.phoneNumber ?? "",
    photoURL: authUser.photoURL ?? "",
    providers: authUser.providerData.map((provider) => provider.providerId),
  }
  const existingSnapshot = await profileRef.get()
  const existingProfile = existingSnapshot.data() ?? {}
  const identityMatches = (profile: typeof existingProfile) =>
    Object.entries(identity).every(([key, value]) =>
      key === "providers"
        ? Array.isArray(profile.providers) &&
          JSON.stringify(profile.providers) === JSON.stringify(value)
        : profile[key] === value
    )
  const profileOwnerMismatch =
    (typeof existingProfile.uid === "string" &&
      existingProfile.uid !== authUser.uid) ||
    (typeof existingProfile.uid !== "string" &&
      typeof existingProfile.emailId === "string" &&
      normalizeEmailId(existingProfile.emailId) !== emailId)

  if (profileOwnerMismatch) {
    throw new Error(
      "The user profile email key is already associated with another account."
    )
  }

  const profileIsNormalized =
    existingSnapshot.exists &&
    identityMatches(existingProfile) &&
    (existingProfile.accountStatus === "pending" ||
      existingProfile.accountStatus === "approved" ||
      existingProfile.accountStatus === "rejected") &&
    typeof existingProfile.employeeId === "string" &&
    typeof existingProfile.aadhaarNumber === "string" &&
    existingProfile.createdAt !== undefined

  if (profileIsNormalized) return { emailId, ref: profileRef }

  await database.runTransaction(async (transaction) => {
    const [profileSnapshot, legacyUidSnapshot] = await Promise.all([
      transaction.get(profileRef),
      transaction.get(legacyUidRef),
    ])
    const currentProfile = profileSnapshot.data() ?? {}
    const queriedLegacySnapshot =
      !profileSnapshot.exists && !legacyUidSnapshot.exists
        ? (
            await transaction.get(
              users.where("uid", "==", authUser.uid).limit(1)
            )
          ).docs[0]
        : undefined
    const legacySnapshot = legacyUidSnapshot.exists
      ? legacyUidSnapshot
      : queriedLegacySnapshot
    const legacyRef = legacyUidSnapshot.exists
      ? legacyUidRef
      : queriedLegacySnapshot?.ref
    const legacyProfile = legacySnapshot?.data() ?? {}

    if (
      (typeof currentProfile.uid === "string" &&
        currentProfile.uid !== authUser.uid) ||
      (typeof currentProfile.uid !== "string" &&
        typeof currentProfile.emailId === "string" &&
        normalizeEmailId(currentProfile.emailId) !== emailId) ||
      (legacySnapshot &&
        typeof legacyProfile.uid === "string" &&
        legacyProfile.uid !== authUser.uid)
    ) {
      throw new Error(
        "The user profile email key is already associated with another account."
      )
    }

    if (!profileSnapshot.exists && !legacySnapshot) return

    const employeeId =
      typeof currentProfile.employeeId === "string"
        ? currentProfile.employeeId
        : typeof legacyProfile.employeeId === "string"
          ? legacyProfile.employeeId
          : ""
    const aadhaarNumber =
      typeof currentProfile.aadhaarNumber === "string"
        ? currentProfile.aadhaarNumber
        : typeof currentProfile.aadharNumber === "string"
          ? currentProfile.aadharNumber
          : typeof legacyProfile.aadhaarNumber === "string"
            ? legacyProfile.aadhaarNumber
            : typeof legacyProfile.aadharNumber === "string"
              ? legacyProfile.aadharNumber
              : ""
    const needsMetadataUpdate =
      Boolean(legacyRef) ||
      !identityMatches(currentProfile) ||
      (currentProfile.accountStatus !== "pending" &&
        currentProfile.accountStatus !== "approved" &&
        currentProfile.accountStatus !== "rejected") ||
      typeof currentProfile.employeeId !== "string" ||
      typeof currentProfile.aadhaarNumber !== "string" ||
      currentProfile.createdAt === undefined

    if (!needsMetadataUpdate) return

    const profileData = {
      ...(legacyRef ? legacyProfile : {}),
      ...currentProfile,
      ...identity,
      accountStatus:
        currentProfile.accountStatus ??
        legacyProfile.accountStatus ??
        "approved",
      employeeId,
      aadhaarNumber,
      createdAt:
        currentProfile.createdAt ??
        legacyProfile.createdAt ??
        FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }

    transaction.set(profileRef, profileData, { merge: true })
    if (legacyRef) transaction.delete(legacyRef)
  })

  return { emailId, ref: profileRef }
}
