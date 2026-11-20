import { NextResponse, type NextRequest } from "next/server"

import { handleChatRequest } from "@/features/chatbot/server/route-handler"
import { getApprovedSessionUid } from "@/lib/registration-access"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const uid = await getApprovedSessionUid(request)
  if (!uid) {
    return NextResponse.json(
      { error: "Account approval is required to use chat." },
      { status: 403 },
    )
  }

  return handleChatRequest(request)
}
