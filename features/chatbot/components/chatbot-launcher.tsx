"use client"

import { BotIcon, XIcon } from "lucide-react"
import { usePathname } from "next/navigation"
import { useState } from "react"

import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { ChatPage } from "@/features/chatbot/components/chat-page"

export function ChatbotLauncher() {
  const { user } = useAuth()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [hasOpened, setHasOpened] = useState(false)

  if (!user || pathname === "/chat" || pathname.startsWith("/dashboard/chat")) {
    return null
  }

  const toggleChat = () => {
    if (!isOpen) setHasOpened(true)
    setIsOpen((open) => !open)
  }

  return (
    <>
      {hasOpened && (
        <section
          aria-hidden={!isOpen}
          aria-label="Local AI chat"
          aria-modal="false"
          className={`fixed right-4 bottom-24 z-40 flex h-[min(700px,calc(100svh-8rem))] w-[calc(100vw-2rem)] max-w-105 flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl sm:right-6 sm:w-105 ${isOpen ? "" : "hidden"}`}
          id="aaptha-chat-panel"
          role="dialog"
        >
          <ChatPage compact onClose={() => setIsOpen(false)} />
        </section>
      )}
      <Button
        aria-controls="aaptha-chat-panel"
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close local AI chat" : "Open local AI chat"}
        className="fixed right-4 bottom-4 z-50 size-14 rounded-full shadow-lg sm:right-6 sm:bottom-6"
        onClick={toggleChat}
        size="icon-lg"
        title={isOpen ? "Close local AI chat" : "Open local AI chat"}
        type="button"
      >
        {isOpen ? <XIcon aria-hidden="true" /> : <BotIcon aria-hidden="true" />}
      </Button>
    </>
  )
}
