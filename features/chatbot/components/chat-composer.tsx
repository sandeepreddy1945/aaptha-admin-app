"use client"

/* eslint-disable @next/next/no-img-element */

import type { ChatStatus, FileUIPart } from "ai"
import {
  FileTextIcon,
  LoaderCircleIcon,
  MicIcon,
  MicOffIcon,
  PaperclipIcon,
  SendIcon,
  SquareIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react"
import type { DragEvent, FormEvent, KeyboardEvent } from "react"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"

import { Button } from "@/components/ui/button"
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import { InputGroup, InputGroupTextarea } from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CHAT_FILE_ACCEPT,
  MAX_CHAT_FILE_SIZE,
  MAX_CHAT_FILES,
  type ChatAttachment,
  type ChatModelOption,
} from "./chat-config"

type SpeechRecognitionResult = {
  isFinal: boolean
  0: { transcript: string }
}

type SpeechRecognitionEvent = {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResult>
}

type SpeechRecognitionInstance = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onend: (() => void) | null
  onerror: (() => void) | null
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

const getSpeechSupport = () =>
  typeof window !== "undefined" &&
  Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition)
const subscribeToSpeechSupport = () => () => {}

export type ChatComposerProps = {
  compact?: boolean
  developerToolsEnabled: boolean
  model: string
  models: ChatModelOption[]
  onDeveloperToolsChange: (enabled: boolean) => void
  onModelChange: (model: string) => void
  onStop: () => void
  onSubmit: (text: string, files: FileUIPart[]) => void | Promise<void>
  status: ChatStatus
}

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}`))
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result)
      } else {
        reject(new Error(`Unable to read ${file.name}`))
      }
    }
    reader.readAsDataURL(file)
  })

const getFileId = (file: File) =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${file.name}-${file.lastModified}-${Math.random()}`

const formatFileSize = (size: number) => {
  if (size < 1024) {
    return `${size} B`
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

export function ChatComposer({
  compact = false,
  developerToolsEnabled,
  model,
  models,
  onDeveloperToolsChange,
  onModelChange,
  onStop,
  onSubmit,
  status,
}: ChatComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [text, setText] = useState("")
  const isSpeechSupported = useSyncExternalStore(
    subscribeToSpeechSupport,
    getSpeechSupport,
    () => false
  )
  const isBusy = status === "submitted" || status === "streaming"
  const canSubmit = Boolean(text.trim() || attachments.length)

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const textareaStyle = window.getComputedStyle(textarea)
    const lineHeight =
      Number.parseFloat(textareaStyle.lineHeight) ||
      Number.parseFloat(textareaStyle.fontSize) * 1.5
    const verticalPadding =
      Number.parseFloat(textareaStyle.paddingTop) +
      Number.parseFloat(textareaStyle.paddingBottom)
    const maxHeight = Math.ceil(lineHeight * 6 + verticalPadding)

    textarea.style.height = "auto"
    const contentHeight = textarea.scrollHeight
    textarea.style.height = `${Math.min(contentHeight, maxHeight)}px`
    textarea.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden"
  }, [compact, text])

  const toggleSpeech = () => {
    if (isListening) {
      recognitionRef.current?.stop()
      return
    }

    const Recognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!Recognition) {
      return
    }

    const recognition = new Recognition()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = "en-US"
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .filter((result) => result.isFinal)
        .map((result) => result[0].transcript.trim())
        .filter(Boolean)
        .join(" ")

      if (transcript) {
        setText((current) =>
          current ? `${current.trimEnd()} ${transcript}` : transcript
        )
      }
    }
    recognition.onerror = () => {
      setIsListening(false)
      recognitionRef.current = null
    }
    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    setIsListening(true)
    try {
      recognition.start()
    } catch {
      setIsListening(false)
      recognitionRef.current = null
    }
  }

  const addFiles = async (incomingFiles: File[] | FileList) => {
    setError(null)
    const incoming = Array.from(incomingFiles)

    if (incoming.length === 0) {
      return
    }

    if (attachments.length + incoming.length > MAX_CHAT_FILES) {
      setError(`You can attach up to ${MAX_CHAT_FILES} files per message.`)
      return
    }

    const oversized = incoming.find((file) => file.size > MAX_CHAT_FILE_SIZE)
    if (oversized) {
      setError(`${oversized.name} exceeds the 10 MB file size limit.`)
      return
    }

    try {
      const nextAttachments = await Promise.all(
        incoming.map(async (file) => ({
          filename: file.name,
          id: getFileId(file),
          mediaType: file.type || "application/octet-stream",
          size: file.size,
          type: "file" as const,
          url: await readFileAsDataUrl(file),
        }))
      )
      setAttachments((current) => [...current, ...nextAttachments])
    } catch (readError) {
      setError(
        readError instanceof Error
          ? readError.message
          : "Unable to read the file."
      )
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isBusy || !canSubmit) {
      return
    }

    const files = attachments.map((attachment) => ({
      filename: attachment.filename,
      mediaType: attachment.mediaType,
      type: "file" as const,
      url: attachment.url,
    }))

    try {
      await onSubmit(text.trim(), files)
      setText("")
      setAttachments([])
      setError(null)
    } catch {
      // Keep the draft and attachments available when a request fails.
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  const handleDrop = (event: DragEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsDragging(false)
    if (event.dataTransfer.files.length > 0) {
      void addFiles(event.dataTransfer.files)
    }
  }

  return (
    <form
      className="mx-auto w-full max-w-4xl"
      onDragEnter={(event) => {
        event.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) {
          setIsDragging(false)
        }
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      onSubmit={handleSubmit}
    >
      <input
        accept={CHAT_FILE_ACCEPT}
        className="hidden"
        multiple
        onChange={(event) => {
          if (event.currentTarget.files) {
            void addFiles(event.currentTarget.files)
          }
          event.currentTarget.value = ""
        }}
        ref={fileInputRef}
        type="file"
      />

      <div
        className={`rounded-xl border bg-background shadow-sm transition-colors ${
          isDragging ? "border-primary bg-primary/5" : "border-input"
        }`}
      >
        {attachments.length > 0 && (
          <AttachmentGroup className="border-b px-3 py-2">
            {attachments.map((attachment) => {
              const isImage = attachment.mediaType.startsWith("image/")

              return (
                <Attachment
                  className="max-w-full"
                  key={attachment.id}
                  size="sm"
                >
                  <AttachmentMedia variant={isImage ? "image" : "icon"}>
                    {isImage ? (
                      <img alt="" src={attachment.url} />
                    ) : (
                      <FileTextIcon />
                    )}
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>{attachment.filename}</AttachmentTitle>
                    <AttachmentDescription>
                      {formatFileSize(attachment.size)}
                    </AttachmentDescription>
                  </AttachmentContent>
                  <AttachmentActions>
                    <AttachmentAction
                      aria-label={`Remove ${attachment.filename}`}
                      onClick={() =>
                        setAttachments((current) =>
                          current.filter((item) => item.id !== attachment.id)
                        )
                      }
                    >
                      <XIcon />
                    </AttachmentAction>
                  </AttachmentActions>
                </Attachment>
              )
            })}
          </AttachmentGroup>
        )}

        <InputGroup className="flex-col items-stretch rounded-xl border-0 shadow-none">
          <InputGroupTextarea
            aria-label="Message"
            className={`field-sizing-fixed w-full px-3 py-3 ${compact ? "min-h-24" : "min-h-20"}`}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message your local Ollama assistant…"
            ref={textareaRef}
            value={text}
          />
          <div
            className={`flex items-center gap-2 px-2 pb-2 ${compact ? "justify-end" : "justify-between"}`}
          >
            <div className="flex min-w-0 items-center gap-1">
              <Button
                aria-label="Attach files"
                disabled={isBusy}
                onClick={() => fileInputRef.current?.click()}
                size="icon-sm"
                title="Attach files"
                type="button"
                variant="ghost"
              >
                <PaperclipIcon />
              </Button>
              <Button
                aria-label={
                  isListening
                    ? "Stop voice input"
                    : isSpeechSupported
                      ? "Use voice input"
                      : "Voice input is not supported in this browser"
                }
                aria-pressed={isListening}
                className={isListening ? "text-destructive" : undefined}
                disabled={isBusy || !isSpeechSupported}
                onClick={toggleSpeech}
                size="icon-sm"
                title={isListening ? "Stop voice input" : "Use voice input"}
                type="button"
                variant="ghost"
              >
                {isListening ? <MicOffIcon /> : <MicIcon />}
              </Button>
              <Button
                aria-label="Toggle developer tools"
                aria-pressed={developerToolsEnabled}
                className={
                  developerToolsEnabled
                    ? "bg-accent text-accent-foreground"
                    : undefined
                }
                disabled={isBusy}
                onClick={() => onDeveloperToolsChange(!developerToolsEnabled)}
                size="icon-sm"
                title={
                  developerToolsEnabled
                    ? "Disable developer tools"
                    : "Enable developer tools"
                }
                type="button"
                variant="ghost"
              >
                <WrenchIcon />
              </Button>
              {!compact && (
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  Enter to send · Shift+Enter for a new line
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {models.length > 1 ? (
                <Select
                  disabled={isBusy}
                  onValueChange={(nextValue) => {
                    if (nextValue) onModelChange(nextValue)
                  }}
                  value={model}
                >
                  <SelectTrigger
                    aria-label="Select Ollama model"
                    className={
                      compact ? "max-w-36 min-w-24" : "max-w-52 min-w-36"
                    }
                    size="sm"
                  >
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectGroup>
                      <SelectLabel>Ollama models</SelectLabel>
                      {models.map((availableModel) => (
                        <SelectItem
                          key={availableModel.id}
                          value={availableModel.id}
                        >
                          <span className="flex min-w-0 flex-col">
                            <span>{availableModel.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {availableModel.id}
                              {availableModel.description
                                ? ` · ${availableModel.description}`
                                : ""}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              ) : (
                <div
                  className={`truncate rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground ${compact ? "max-w-32" : "max-w-52"}`}
                >
                  {models[0]?.name ?? model}
                </div>
              )}
              <Button
                aria-label={isBusy ? "Stop generating" : "Send message"}
                disabled={!isBusy && !canSubmit}
                onClick={isBusy ? onStop : undefined}
                size="icon-sm"
                title={isBusy ? "Stop generating" : "Send message"}
                type={isBusy ? "button" : "submit"}
              >
                {isBusy ? (
                  status === "submitted" ? (
                    <LoaderCircleIcon className="animate-spin" />
                  ) : (
                    <SquareIcon />
                  )
                ) : (
                  <SendIcon />
                )}
              </Button>
            </div>
          </div>
        </InputGroup>
      </div>
      {(isDragging || error || !compact) && (
        <div className="flex min-h-6 items-center justify-between px-1 pt-2 text-xs text-muted-foreground">
          {isDragging ? (
            <span>Drop files to attach them</span>
          ) : (
            !compact && (
              <span>
                Local model · Developer tools{" "}
                {developerToolsEnabled ? "on" : "off"}
              </span>
            )
          )}
          {error && <span className="text-destructive">{error}</span>}
        </div>
      )}
    </form>
  )
}
