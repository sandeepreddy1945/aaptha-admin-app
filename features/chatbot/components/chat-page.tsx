"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type FileUIPart } from "ai"
import Link from "next/link"
import { BotIcon, RotateCcwIcon, SparklesIcon, XIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Shimmer } from "@/components/ui/shimmer"
import { useAuth } from "@/components/auth-provider"
import {
  createConversationId,
  loadLatestConversation,
  saveConversation,
} from "@/features/chatbot/lib/chat-database"
import type { ChatModelOption } from "./chat-config"
import { ChatComposer } from "./chat-composer"
import { ChatEmptyState } from "./chat-empty-state"
import { ChatMessage } from "./chat-message"

const transport = new DefaultChatTransport({
  api: process.env.NEXT_PUBLIC_MCP_CHAT_URL ?? "/api/chat",
})

type ChatModelsResponse = {
  defaultModel: string | null
  error?: string
  models: ChatModelOption[]
}

type ChatPageProps = {
  compact?: boolean
  onClose?: () => void
}

export function ChatPage({ compact = false, onClose }: ChatPageProps) {
  const { user } = useAuth()
  if (!user) return null

  return (
    <ChatSession
      compact={compact}
      key={user.uid}
      onClose={onClose}
      userId={user.uid}
    />
  )
}

function ChatSession({
  userId,
  compact,
  onClose,
}: {
  userId: string
  compact: boolean
  onClose?: () => void
}) {
  const [models, setModels] = useState<ChatModelOption[]>([])
  const [selectedModel, setSelectedModel] = useState("")
  const [developerToolsEnabled, setDeveloperToolsEnabled] = useState(true)
  const [modelConfigurationError, setModelConfigurationError] =
    useState<string | null>(null)
  const [isLoadingModels, setIsLoadingModels] = useState(true)
  const [isPersistenceReady, setIsPersistenceReady] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const conversationIdRef = useRef<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const {
    clearError,
    error,
    messages,
    sendMessage,
    setMessages,
    status,
    stop,
  } = useChat({ transport })
  const messagesRef = useRef(messages)
  const isBusy = status === "submitted" || status === "streaming"
  const lastMessage = messages.at(-1)
  const modelName =
    models.find((model) => model.id === selectedModel)?.name ?? selectedModel

  useEffect(() => {
    let cancelled = false

    fetch("/api/chat/models", { cache: "no-store" })
      .then(async (response) => {
        const payload: unknown = await response.json().catch(() => null)
        if (!response.ok) {
          const message =
            typeof payload === "object" && payload !== null && "error" in payload
              ? String(payload.error)
              : "Unable to load Ollama model configuration."
          throw new Error(message)
        }
        return payload as ChatModelsResponse
      })
      .then((configuration) => {
        if (cancelled) return

        if (
          !Array.isArray(configuration.models) ||
          configuration.models.length === 0 ||
          !configuration.defaultModel ||
          !configuration.models.some(
            (model) => model.id === configuration.defaultModel,
          )
        ) {
          setModelConfigurationError(
            configuration.error ??
              "No Ollama models are configured. Set OLLAMA_MODELS or OLLAMA_MODEL in .env.local.",
          )
          return
        }

        setModels(configuration.models)
        setSelectedModel(configuration.defaultModel)
        setModelConfigurationError(null)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setModelConfigurationError(
            error instanceof Error
              ? error.message
              : "Unable to load Ollama model configuration.",
          )
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingModels(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, status])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    if (!userId) return

    let cancelled = false

    void loadLatestConversation(userId).then((conversation) => {
      if (cancelled) {
        return
      }

      const hasCurrentMessages = messagesRef.current.length > 0
      if (hasCurrentMessages) {
        conversationIdRef.current = createConversationId()
      } else {
        conversationIdRef.current = conversation?.id ?? createConversationId()
        if (conversation?.messages.length) {
          setMessages(conversation.messages)
        }
      }
      setIsPersistenceReady(true)
    })

    return () => {
      cancelled = true
    }
  }, [setMessages, userId])

  useEffect(() => {
    if (
      !userId ||
      !isPersistenceReady ||
      !conversationIdRef.current ||
      messages.length === 0
    ) {
      return
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }

    const conversationId = conversationIdRef.current
    saveTimerRef.current = setTimeout(() => {
      void saveConversation({ userId, id: conversationId, messages })
      saveTimerRef.current = null
    }, 300)

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }
  }, [isPersistenceReady, messages, userId])

  useEffect(() => {
    if (!userId || !isPersistenceReady) return

    const flushConversation = () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }

      const conversationId = conversationIdRef.current
      const latestMessages = messagesRef.current
      if (!conversationId || latestMessages.length === 0) return

      void saveConversation({
        userId,
        id: conversationId,
        messages: latestMessages,
      })
    }

    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") flushConversation()
    }

    window.addEventListener("pagehide", flushConversation)
    document.addEventListener("visibilitychange", flushWhenHidden)
    return () => {
      window.removeEventListener("pagehide", flushConversation)
      document.removeEventListener("visibilitychange", flushWhenHidden)
    }
  }, [isPersistenceReady, userId])

  const sendText = async (text: string, files: FileUIPart[] = []) => {
    if (!selectedModel || (!text.trim() && files.length === 0) || isBusy) {
      return
    }

    if (files.length > 0 && text.trim()) {
      await sendMessage(
        { files, text: text.trim() },
        { body: { model: selectedModel, developerToolsEnabled } }
      )
      return
    }

    if (files.length > 0) {
      await sendMessage({ files }, { body: { model: selectedModel, developerToolsEnabled } })
      return
    }

    await sendMessage({ text: text.trim() }, { body: { model: selectedModel, developerToolsEnabled } })
  }

  return (
    <main
      className={`flex ${compact ? "h-full min-h-0" : "h-svh min-h-svh"} flex-col bg-background`}
    >
      <header className="flex shrink-0 items-center justify-between border-b px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {compact ? (
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <SparklesIcon className="size-4" />
            </div>
          ) : (
            <Link
              aria-label="Return to Dashboard"
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:opacity-80"
              href="/dashboard"
              title="Dashboard"
            >
              <SparklesIcon className="size-4" />
            </Link>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold sm:text-base" id="aaptha-chat-title">
              Ask Aaptha Elder Care
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {modelName ? `${modelName} · Ollama` : "Ollama model not configured"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground sm:flex">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Local
          </div>
          {compact && onClose && (
            <Button
              aria-label="Close local AI chat"
              onClick={onClose}
              size="icon-sm"
              title="Close chat window"
              type="button"
              variant="ghost"
            >
              <XIcon aria-hidden="true" />
            </Button>
          )}
          <Button
            aria-label="Start a new chat"
            disabled={messages.length === 0 || isBusy}
            onClick={() => {
              if (!userId) return
              const newConversationId = createConversationId()
              conversationIdRef.current = newConversationId
              setMessages([])
              void saveConversation({
                userId,
                id: newConversationId,
                messages: [],
              })
              clearError()
            }}
            size="sm"
            title="Start a new chat"
            type="button"
            variant="outline"
          >
            <RotateCcwIcon />
            <span className="hidden sm:inline">New chat</span>
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        <div className="mx-auto min-h-full w-full max-w-5xl px-4 md:px-6">
          {messages.length === 0 ? (
            <ChatEmptyState
              compact={compact}
              onSuggestion={(suggestion) => void sendText(suggestion)}
            />
          ) : (
            <div className="space-y-6 py-8">
              {messages.map((message) => (
                <ChatMessage
                  isStreaming={
                    isBusy &&
                    message.id === lastMessage?.id &&
                    message.role === "assistant"
                  }
                  key={message.id}
                  message={message}
                />
              ))}
              {isBusy && lastMessage?.role !== "assistant" && (
                <div className="flex items-center gap-3">
                  <Avatar aria-label="Assistant message" size="sm">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <BotIcon aria-hidden="true" />
                    </AvatarFallback>
                  </Avatar>
                  <Shimmer aria-live="polite" role="status">
                    Presenting Loading ...
                  </Shimmer>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t bg-background/95 px-4 pt-3 pb-4 backdrop-blur md:px-6">
        {error && (
          <div
            className="mx-auto mb-3 flex w-full max-w-4xl items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            <span>{error.message || "Something went wrong."}</span>
            <Button
              onClick={clearError}
              size="xs"
              type="button"
              variant="ghost"
            >
              Dismiss
            </Button>
          </div>
        )}
        {isLoadingModels ? (
          <div
            aria-live="polite"
            className="mx-auto flex min-h-20 w-full max-w-4xl items-center justify-center"
            role="status"
          >
            <Shimmer>Loading configured Ollama models…</Shimmer>
          </div>
        ) : modelConfigurationError ? (
          <div
            className="mx-auto w-full max-w-4xl rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {modelConfigurationError}
          </div>
        ) : (
          <ChatComposer
            compact={compact}
            developerToolsEnabled={developerToolsEnabled}
            model={selectedModel}
            models={models}
            onDeveloperToolsChange={setDeveloperToolsEnabled}
            onModelChange={setSelectedModel}
            onStop={() => void stop()}
            onSubmit={sendText}
            status={status}
          />
        )}
        {!compact && !isLoadingModels && !modelConfigurationError && (
          <p className="mx-auto mt-1 flex max-w-4xl items-center justify-center gap-1 text-center text-[11px] text-muted-foreground">
            <BotIcon className="size-3" />
            Responses are generated locally by Ollama. Reasoning is shown when the
            model provides it.
          </p>
        )}
      </div>
    </main>
  )
}
