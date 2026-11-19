import type { Metadata } from "next"

import { ChatPage } from "@/features/chatbot/components/chat-page"

export const metadata: Metadata = {
  title: "Ask Aaptha Elder Care",
  description: "Chat with the Aaptha Elder Care assistant.",
}

export default function Page() {
  return <ChatPage />
}
