import { FieldValue, getFirestore } from "firebase-admin/firestore"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { FIREBASE_SESSION_COOKIE } from "@/lib/auth-constants"
import { getFirebaseAdminApp, getFirebaseAdminAuth } from "@/lib/firebase-admin"

const editableProfileSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    middleName: z.string().trim().max(80),
    lastName: z.string().trim().min(1).max(80),
    alternateEmail: z
      .string()
      .trim()
      .max(254)
      .refine((value) => value === "" || z.email().safeParse(value).success),
    primaryPhone: z
      .string()
      .trim()
      .max(24)
      .refine((value) => value === "" || /^\+?[\d\s().-]{7,24}$/.test(value)),
    secondaryPhone: z
      .string()
      .trim()
      .max(24)
      .refine((value) => value === "" || /^\+?[\d\s().-]{7,24}$/.test(value)),
    address: z.string().trim().max(1000),
  })
  .strict()

function getStoredString(value: unknown) {
  return typeof value === "string" ? value : ""
}

function maskAadhaar(value: unknown) {
  if (typeof value !== "string") return ""

  const digits = value.replace(/\D/g, "")
  if (digits.length < 4) return digits ? "••••" : ""

  return `•••• •••• ${digits.slice(-4)}`
}

async function getSessionUid(request: NextRequest) {
  const sessionCookie = request.cookies.get(FIREBASE_SESSION_COOKIE)?.value
  if (!sessionCookie) return null

  try {
    const session = await getFirebaseAdminAuth().verifySessionCookie(
      sessionCookie,
      true,
    )
    return session.uid
  } catch {
    return null
  }
}

function getProfileDocument(uid: string) {
  return getFirestore(getFirebaseAdminApp()).collection("users").doc(uid)
}

export async function GET(request: NextRequest) {
  const uid = await getSessionUid(request)
  if (!uid) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 })
  }

  try {
    const snapshot = await getProfileDocument(uid).get()
    const profile = snapshot.data() ?? {}

    return NextResponse.json({
      firstName: getStoredString(profile.firstName),
      middleName: getStoredString(profile.middleName),
      lastName: getStoredString(profile.lastName),
      alternateEmail: getStoredString(profile.alternateEmail),
      primaryPhone: getStoredString(profile.primaryPhone),
      secondaryPhone: getStoredString(profile.secondaryPhone),
      address: getStoredString(profile.address),
      employeeId: getStoredString(profile.employeeId),
      aadhaarMasked: maskAadhaar(profile.aadhaarNumber ?? profile.aadharNumber),
    })
  } catch (error) {
    console.error("Unable to load the signed-in user's profile.", error)
    return NextResponse.json(
      { error: "Unable to load your profile." },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  const uid = await getSessionUid(request)
  if (!uid) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const parsed = editableProfileSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please correct the invalid profile fields." },
      { status: 400 },
    )
  }

  try {
    await getProfileDocument(uid).set(
      {
        ...parsed.data,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )

    return NextResponse.json({ profile: parsed.data })
  } catch (error) {
    console.error("Unable to save the signed-in user's profile.", error)
    return NextResponse.json(
      { error: "Unable to save your profile." },
      { status: 500 },
    )
  }
}
