import { NextResponse } from "next/server"

import {
  FIREBASE_SESSION_COOKIE,
  FIREBASE_SESSION_DURATION_MS,
  FIREBASE_SESSION_DURATION_SECONDS,
} from "@/lib/auth-constants"
import { getFirebaseAdminAuth } from "@/lib/firebase-admin"

export async function POST(request: Request) {
  let payload: unknown

  try {
    payload = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    )
  }

  const idToken =
    typeof payload === "object" && payload !== null && "idToken" in payload
      ? payload.idToken
      : null

  if (
    typeof idToken !== "string" ||
    idToken.length === 0 ||
    idToken.length > 10_000
  ) {
    return NextResponse.json(
      { error: "A valid Firebase ID token is required." },
      { status: 400 }
    )
  }

  let adminAuth
  try {
    adminAuth = getFirebaseAdminAuth()
  } catch (error) {
    console.error("Firebase Admin SDK initialization failed.", error)
    return NextResponse.json(
      { error: "Server authentication is not configured." },
      { status: 500 }
    )
  }

  try {
    await adminAuth.verifyIdToken(idToken, true)
  } catch {
    return NextResponse.json(
      { error: "The Firebase ID token is invalid or expired." },
      { status: 401 }
    )
  }

  try {
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: FIREBASE_SESSION_DURATION_MS,
    })
    const response = new NextResponse(null, { status: 204 })

    response.cookies.set(FIREBASE_SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: FIREBASE_SESSION_DURATION_SECONDS,
    })

    return response
  } catch (error) {
    console.error("Firebase session cookie creation failed.", error)
    return NextResponse.json(
      { error: "Unable to create an authenticated session." },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  const response = new NextResponse(null, { status: 204 })

  response.cookies.set(FIREBASE_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })

  return response
}
