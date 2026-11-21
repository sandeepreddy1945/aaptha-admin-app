import { FieldValue, getFirestore } from "firebase-admin/firestore"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { getFirebaseAdminApp, getFirebaseAdminAuth } from "@/lib/firebase-admin"
import { getAccountAccess, getSessionUid } from "@/lib/registration-access"
import { getOrMigrateUserProfileDocument } from "@/lib/user-profile"

const actionSchema = z
  .object({
    action: z.enum(["ensure", "reapply"]).optional(),
  })
  .strict()

export async function POST(request: NextRequest) {
  const uid = await getSessionUid(request)
  if (!uid) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    )
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    payload = {}
  }

  const parsed = actionSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid registration request." },
      { status: 400 }
    )
  }

  try {
    const authUser = await getFirebaseAdminAuth().getUser(uid)
    const database = getFirestore(getFirebaseAdminApp())
    const registrationRef = database.collection("registrationRequests").doc(uid)
    const { emailId, ref: profileRef } =
      await getOrMigrateUserProfileDocument(authUser)
    const identity = {
      uid,
      emailId,
      displayName: authUser.displayName ?? "",
      email: authUser.email ?? "",
      emailVerified: authUser.emailVerified,
      phoneNumber: authUser.phoneNumber ?? "",
      photoURL: authUser.photoURL ?? "",
      providers: authUser.providerData.map((provider) => provider.providerId),
    }

    const status = await database.runTransaction(async (transaction) => {
      const [registrationSnapshot, profileSnapshot] = await Promise.all([
        transaction.get(registrationRef),
        transaction.get(profileRef),
      ])
      const registration = registrationSnapshot.data()
      const profile = profileSnapshot.data()
      const action = parsed.data.action ?? "ensure"

      if (registrationSnapshot.exists) {
        const currentStatus =
          registration?.status === "approved" ||
          registration?.status === "rejected" ||
          registration?.status === "pending"
            ? registration.status
            : "pending"

        if (action === "reapply" && currentStatus === "rejected") {
          transaction.set(
            registrationRef,
            {
              ...identity,
              status: "pending",
              requestedAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
              attemptCount:
                (typeof registration?.attemptCount === "number"
                  ? registration.attemptCount
                  : 1) + 1,
              approvedAt: FieldValue.delete(),
              approvedBy: FieldValue.delete(),
              rejectedAt: FieldValue.delete(),
              rejectedBy: FieldValue.delete(),
            },
            { merge: true }
          )
          transaction.set(
            profileRef,
            {
              ...identity,
              accountStatus: "pending",
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          )
          return "pending" as const
        }

        if (currentStatus === "pending") {
          transaction.set(
            registrationRef,
            { ...identity, updatedAt: FieldValue.serverTimestamp() },
            { merge: true }
          )
        }
        transaction.set(
          profileRef,
          {
            ...identity,
            accountStatus: currentStatus,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        )
        return currentStatus
      }

      const profileStatus = profile?.accountStatus
      if (
        profileSnapshot.exists &&
        profileStatus !== "pending" &&
        profileStatus !== "rejected"
      ) {
        transaction.set(
          profileRef,
          {
            ...identity,
            accountStatus: "approved",
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        )
        return "approved" as const
      }

      if (profileStatus === "rejected" && action !== "reapply") {
        return "rejected" as const
      }

      transaction.create(registrationRef, {
        ...identity,
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
        requestedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        attemptCount: 1,
      })
      transaction.set(
        profileRef,
        {
          ...identity,
          accountStatus: "pending",
          aadhaarNumber:
            typeof profile?.aadhaarNumber === "string"
              ? profile.aadhaarNumber
              : typeof profile?.aadharNumber === "string"
                ? profile.aadharNumber
                : "",
          employeeId:
            typeof profile?.employeeId === "string" ? profile.employeeId : "",
          createdAt: profile?.createdAt ?? FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      return "pending" as const
    })

    const access = await getAccountAccess(uid)
    return NextResponse.json({
      hasRequiredRole: access.hasRequiredRole,
      isAdmin: access.isAdmin,
      roles: access.roles,
      status,
    })
  } catch (error) {
    console.error("Unable to register the Firebase user request.", error)
    return NextResponse.json(
      { error: "Unable to load or create your access request." },
      { status: 500 }
    )
  }
}
