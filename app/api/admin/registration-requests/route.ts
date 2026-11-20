import { FieldValue, getFirestore } from "firebase-admin/firestore"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { getFirebaseAdminApp, getFirebaseAdminAuth } from "@/lib/firebase-admin"
import { getAdminSessionUid } from "@/lib/registration-access"
import { getOrMigrateUserProfileDocument } from "@/lib/user-profile"

const uidSchema = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9:_-]+$/)
const actionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("approve"),
      uid: uidSchema,
      roles: z.array(z.enum(["admin", "hr"])).min(1).max(2).refine(
        (roles) => new Set(roles).size === roles.length,
        "Roles must be unique.",
      ),
    })
    .strict(),
  z.object({ action: z.literal("reject"), uid: uidSchema }).strict(),
])

class RequestActionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

function toIsoString(value: unknown) {
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate().toISOString()
  }

  return ""
}

export async function GET(request: NextRequest) {
  const adminUid = await getAdminSessionUid(request)
  if (!adminUid) {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 })
  }

  try {
    const pendingRequests = getFirestore(getFirebaseAdminApp())
      .collection("registrationRequests")
      .where("status", "==", "pending")

    if (request.nextUrl.searchParams.get("countOnly") === "true") {
      const countSnapshot = await pendingRequests.count().get()
      return NextResponse.json({ count: countSnapshot.data().count })
    }

    const snapshot = await pendingRequests.get()
    const requests = snapshot.docs
      .map((document) => {
        const data = document.data()
        return {
          uid: document.id,
          displayName: typeof data.displayName === "string" ? data.displayName : "",
          email: typeof data.email === "string" ? data.email : "",
          emailVerified: data.emailVerified === true,
          phoneNumber: typeof data.phoneNumber === "string" ? data.phoneNumber : "",
          photoURL: typeof data.photoURL === "string" ? data.photoURL : "",
          providers: Array.isArray(data.providers)
            ? data.providers.filter((provider): provider is string => typeof provider === "string")
            : [],
          requestedAt: toIsoString(data.requestedAt),
        }
      })
      .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt))

    return NextResponse.json({ requests, count: requests.length })
  } catch (error) {
    console.error("Unable to load registration requests.", error)
    return NextResponse.json(
      { error: "Unable to load registration notifications." },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const adminUid = await getAdminSessionUid(request)
  if (!adminUid) {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const parsed = actionSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid registration action." }, { status: 400 })
  }

  const { action, uid } = parsed.data
  const roles = action === "approve" ? parsed.data.roles : []
  const database = getFirestore(getFirebaseAdminApp())
  const registrationRef = database.collection("registrationRequests").doc(uid)
  const counterRef = database.collection("systemCounters").doc("employeeIds")

  try {
    const authUser = await getFirebaseAdminAuth().getUser(uid)
    const { emailId, ref: profileRef } =
      await getOrMigrateUserProfileDocument(authUser)
    const employeePrefix = process.env.EMPLOYEE_ID_PREFIX?.trim() || "EMP"
    if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,9}$/.test(employeePrefix)) {
      throw new Error("EMPLOYEE_ID_PREFIX must contain 1-10 letters, digits, or hyphens.")
    }

    const result = await database.runTransaction(async (transaction) => {
      const [registrationSnapshot, profileSnapshot, counterSnapshot] =
        await Promise.all([
          transaction.get(registrationRef),
          transaction.get(profileRef),
          action === "approve" ? transaction.get(counterRef) : Promise.resolve(null),
        ])

      if (!registrationSnapshot.exists) {
        throw new RequestActionError("Registration request not found.", 404)
      }

      const registration = registrationSnapshot.data()
      if (!registration) {
        throw new RequestActionError("Registration request not found.", 404)
      }
      const profile = profileSnapshot.data() ?? {}
      const status = registration.status

      if (action === "approve") {
        if (status === "rejected") {
          throw new RequestActionError("This request was rejected and must be resubmitted first.", 409)
        }

        if (status === "approved") {
          const existingEmployeeId =
            typeof registration.employeeId === "string"
              ? registration.employeeId
              : typeof profile.employeeId === "string"
                ? profile.employeeId
                : ""
          return { status: "approved" as const, employeeId: existingEmployeeId }
        }

        if (status !== "pending") {
          throw new RequestActionError("This request cannot be approved.", 409)
        }

        let employeeId =
          typeof profile.employeeId === "string" ? profile.employeeId : ""
        if (!employeeId) {
          const lastIssued = counterSnapshot?.data()?.lastIssued
          let nextNumber =
            (typeof lastIssued === "number" && Number.isSafeInteger(lastIssued)
              ? lastIssued
              : 0) + 1

          while (true) {
            const candidate = `${employeePrefix.toUpperCase()}-${String(nextNumber).padStart(6, "0")}`
            const assignmentRef = database
              .collection("employeeIdAssignments")
              .doc(candidate)
            const [assignmentSnapshot, existingUsers] = await Promise.all([
              transaction.get(assignmentRef),
              transaction.get(
                database.collection("users").where("employeeId", "==", candidate).limit(1),
              ),
            ])

            if (!assignmentSnapshot.exists && existingUsers.empty) {
              employeeId = candidate
              transaction.create(assignmentRef, {
                uid,
                assignedAt: FieldValue.serverTimestamp(),
              })
              break
            }
            nextNumber += 1
          }

          transaction.set(counterRef, {
            lastIssued: nextNumber,
            updatedAt: FieldValue.serverTimestamp(),
          })
        }

        const nameParts = (authUser.displayName ?? "").trim().split(/\s+/).filter(Boolean)
        transaction.set(
          profileRef,
          {
            uid,
            emailId,
            email: authUser.email ?? emailId,
            accountStatus: "approved",
            employeeId,
            roles: roles.join(","),
            aadhaarNumber:
              typeof profile.aadhaarNumber === "string"
                ? profile.aadhaarNumber
                : typeof profile.aadharNumber === "string"
                  ? profile.aadharNumber
                  : "",
            emailVerified: authUser.emailVerified,
            phoneNumber: authUser.phoneNumber ?? "",
            photoURL: authUser.photoURL ?? "",
            providers: authUser.providerData.map((provider) => provider.providerId),
            displayName: authUser.displayName ?? "",
            firstName:
              typeof profile.firstName === "string" && profile.firstName
                ? profile.firstName
                : nameParts[0] ?? "",
            lastName:
              typeof profile.lastName === "string" && profile.lastName
                ? profile.lastName
                : nameParts.length > 1
                  ? nameParts.slice(1).join(" ")
                  : "",
            approvedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        )
        transaction.update(registrationRef, {
          status: "approved",
          employeeId,
          roles: roles.join(","),
          approvedAt: FieldValue.serverTimestamp(),
          approvedBy: adminUid,
          updatedAt: FieldValue.serverTimestamp(),
        })
        return { status: "approved" as const, employeeId }
      }

      if (status === "approved") {
        throw new RequestActionError("Approved users cannot be rejected.", 409)
      }

      if (status === "pending") {
        transaction.update(registrationRef, {
          status: "rejected",
          rejectedAt: FieldValue.serverTimestamp(),
          rejectedBy: adminUid,
          updatedAt: FieldValue.serverTimestamp(),
        })
        transaction.set(
          profileRef,
          {
            uid,
            emailId,
            email: authUser.email ?? emailId,
            accountStatus: "rejected",
            emailVerified: authUser.emailVerified,
            phoneNumber: authUser.phoneNumber ?? "",
            photoURL: authUser.photoURL ?? "",
            providers: authUser.providerData.map((provider) => provider.providerId),
            displayName: authUser.displayName ?? "",
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        )
      }

      return { status: "rejected" as const, employeeId: "" }
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof RequestActionError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "auth/user-not-found") {
      return NextResponse.json({ error: "Firebase account not found." }, { status: 404 })
    }

    console.error("Unable to update registration request.", error)
    return NextResponse.json(
      { error: "Unable to update the registration request." },
      { status: 500 },
    )
  }
}
