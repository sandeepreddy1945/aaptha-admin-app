import { handleChatRequest } from "@/features/chatbot/server/route-handler"

export const runtime = "nodejs"

export async function POST(request: Request) {
  return handleChatRequest(request)
}
