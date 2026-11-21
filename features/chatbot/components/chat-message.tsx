"use client"

/* eslint-disable @next/next/no-img-element */

import { isReasoningUIPart, isToolUIPart, type UIMessage } from "ai"
import {
  BotIcon,
  BrainCircuitIcon,
  FileTextIcon,
  WrenchIcon,
  User,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import { CodeBlock, CodeBlockContent } from "@/components/ui/code-block"
import { Message, MessageContent } from "@/components/ui/message"
import { Shimmer } from "@/components/ui/shimmer"
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"
import { cn } from "@/lib/utils"
import { Fragment, useState } from "react"

import { GraphCard } from "./graph-card"
import { isGraphToolOutput } from "./dummy-graph-data"

export type ChatMessageProps = {
  isStreaming?: boolean
  message: UIMessage
}

const formatValue = (value: unknown) => {
  if (value === undefined) {
    return ""
  }

  if (typeof value === "string") {
    return value
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function ChatMessage({
  isStreaming = false,
  message,
}: ChatMessageProps) {
  const isUser = message.role === "user"
  const [openTraces, setOpenTraces] = useState<Record<string, boolean>>({})
  const hasTextContent = message.parts.some(
    (part) => part.type === "text" && part.text.trim().length > 0
  )
  const hasReasoningPart = message.parts.some((part) => isReasoningUIPart(part))

  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}>
      <Avatar
        aria-label={isUser ? "User message" : "Assistant message"}
        size="sm"
      >
        <AvatarFallback
          className={
            isUser
              ? "bg-secondary text-secondary-foreground"
              : "bg-primary text-primary-foreground"
          }
        >
          {isUser ? (
            <User aria-hidden="true" />
          ) : (
            <BotIcon aria-hidden="true" />
          )}
        </AvatarFallback>
      </Avatar>

      <Message
        align={isUser ? "end" : "start"}
        className={isUser ? "max-w-[min(85%,48rem)]" : "w-full max-w-[52rem]"}
      >
        <MessageContent
          className={cn(
            "space-y-3",
            isUser && "rounded-lg bg-secondary px-4 py-3"
          )}
        >
          {message.parts.map((part, index) => {
            const key = `${message.id}-${index}`

            if (part.type === "text") {
              return (
                <p className="leading-relaxed whitespace-pre-wrap" key={key}>
                  {part.text}
                </p>
              )
            }

            if (part.type === "file") {
              const isImage = part.mediaType.startsWith("image/")

              return (
                <AttachmentGroup key={key}>
                  <Attachment size="sm">
                    <AttachmentMedia variant={isImage ? "image" : "icon"}>
                      {isImage ? (
                        <img
                          alt={part.filename ?? "Uploaded image"}
                          src={part.url}
                        />
                      ) : (
                        <FileTextIcon />
                      )}
                    </AttachmentMedia>
                    <AttachmentContent>
                      <AttachmentTitle>
                        {part.filename ?? "Uploaded file"}
                      </AttachmentTitle>
                      <AttachmentDescription>
                        {part.mediaType}
                      </AttachmentDescription>
                    </AttachmentContent>
                  </Attachment>
                </AttachmentGroup>
              )
            }

            if (isReasoningUIPart(part)) {
              const isReasoningOpen = openTraces[key] ?? isStreaming

              return (
                <Trace key={key}>
                  <TraceCollapsible
                    onOpenChange={(open) =>
                      setOpenTraces((current) => ({
                        ...current,
                        [key]: open,
                      }))
                    }
                    open={isReasoningOpen}
                  >
                    <TraceCollapsibleTrigger>
                      <TraceLine status={isStreaming ? "running" : "pending"}>
                        <TraceIcon>
                          <BrainCircuitIcon />
                        </TraceIcon>
                        <TraceTitle>
                          {isStreaming ? "Thinking…" : "Reasoning"}
                        </TraceTitle>
                        {!isStreaming && (
                          <TraceDescription>Completed</TraceDescription>
                        )}
                      </TraceLine>
                    </TraceCollapsibleTrigger>
                    <TraceCollapsibleContent>
                      <p className="whitespace-pre-wrap">{part.text}</p>
                    </TraceCollapsibleContent>
                  </TraceCollapsible>
                </Trace>
              )
            }

            if (isToolUIPart(part)) {
              const toolPart = part as unknown as {
                errorText?: string
                input?: unknown
                output?: unknown
                state: string
                toolName?: string
                type: string
              }
              const toolName =
                toolPart.toolName ??
                (toolPart.type.startsWith("tool-")
                  ? toolPart.type.slice(5)
                  : toolPart.type)
              const isRunning =
                toolPart.state === "input-streaming" ||
                toolPart.state === "input-available"
              const hasError = Boolean(toolPart.errorText)
              const graphOutput =
                toolName === "presentGraph" &&
                isGraphToolOutput(toolPart.output)
                  ? toolPart.output
                  : undefined

              return (
                <Fragment key={key}>
                  {graphOutput && <GraphCard graph={graphOutput} />}
                  <Trace>
                    <TraceCollapsible>
                      <TraceCollapsibleTrigger>
                        <TraceLine
                          status={
                            hasError
                              ? "error"
                              : isRunning
                                ? "running"
                                : "pending"
                          }
                        >
                          <TraceIcon>
                            <WrenchIcon />
                          </TraceIcon>
                          <TraceTitle>{toolName}</TraceTitle>
                          <TraceDescription>
                            {hasError
                              ? "Error"
                              : isRunning
                                ? "Running"
                                : "Completed"}
                          </TraceDescription>
                        </TraceLine>
                      </TraceCollapsibleTrigger>
                      <TraceCollapsibleContent>
                        <div className="space-y-3">
                          {toolPart.input !== undefined && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">
                                Input
                              </p>
                              <CodeBlock size="sm">
                                <CodeBlockContent>
                                  {formatValue(toolPart.input)}
                                </CodeBlockContent>
                              </CodeBlock>
                            </div>
                          )}
                          {toolPart.output !== undefined && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">
                                Output
                              </p>
                              <CodeBlock size="sm">
                                <CodeBlockContent>
                                  {formatValue(toolPart.output)}
                                </CodeBlockContent>
                              </CodeBlock>
                            </div>
                          )}
                          {toolPart.errorText && (
                            <p className="text-xs text-destructive">
                              {toolPart.errorText}
                            </p>
                          )}
                        </div>
                      </TraceCollapsibleContent>
                    </TraceCollapsible>
                  </Trace>
                </Fragment>
              )
            }

            return null
          })}
          {!isUser && isStreaming && !hasTextContent && !hasReasoningPart && (
            <Shimmer aria-live="polite" role="status">
              Presenting Loading ...
            </Shimmer>
          )}
        </MessageContent>
      </Message>
    </div>
  )
}
