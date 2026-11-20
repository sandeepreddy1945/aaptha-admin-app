import { NextResponse, type NextRequest } from "next/server"

import { getChatModelConfiguration } from "@/features/chatbot/server/model-config"
import { getApprovedSessionUid } from "@/lib/registration-access"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const uid = await getApprovedSessionUid(request)
  if (!uid) {
    return NextResponse.json(
      { error: "Account approval is required to use chat." },
      { status: 403 },
    )
  }

  try {
    return NextResponse.json(getChatModelConfiguration())
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to read Ollama model configuration.",
      },
      { status: 500 },
    )
  }
}
