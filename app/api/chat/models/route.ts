import { NextResponse } from "next/server"

import { getChatModelConfiguration } from "@/features/chatbot/server/model-config"

export const runtime = "nodejs"

export function GET() {
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
