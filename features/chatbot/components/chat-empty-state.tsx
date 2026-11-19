"use client"

import { MessageCircleMoreIcon, SparklesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export const CHAT_SUGGESTIONS = [
  "What can you help me with?",
  "Present the monthly performance graph.",
  "Use an available MCP tool to inspect the current context.",
  "Summarize the information I provide in a file.",
]

export type ChatEmptyStateProps = {
  compact?: boolean
  onSuggestion: (suggestion: string) => void
}

export function ChatEmptyState({
  compact = false,
  onSuggestion,
}: ChatEmptyStateProps) {
  return (
    <div className="flex min-h-full items-center justify-center py-16">
      <div className="flex w-full max-w-2xl flex-col items-center gap-8 text-center">
        <div className="space-y-3">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <SparklesIcon className="size-7" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">
            What can I help you explore?
          </h2>
          <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
            Welcome to Aaptha Elder Care. Ask a question and I’ll help you find
            the information you need.
          </p>
        </div>

        <div
          className={`grid w-full gap-2 ${compact ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-4"}`}
        >
          {CHAT_SUGGESTIONS.map((suggestion, index) => (
            <Button
              className={
                compact
                  ? "h-auto min-h-9 w-full justify-start gap-2 px-3 py-2 text-left text-xs leading-snug whitespace-normal"
                  : "h-auto min-h-16 justify-start gap-2 px-4 py-3 text-left text-sm whitespace-normal"
              }
              key={suggestion}
              onClick={() => onSuggestion(suggestion)}
              type="button"
              variant="outline"
            >
              <MessageCircleMoreIcon
                className={`mt-0.5 shrink-0 text-muted-foreground ${compact ? "size-3.5" : "size-4"}`}
              />
              <span>{suggestion}</span>
              <span className="sr-only">Suggestion {index + 1}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
