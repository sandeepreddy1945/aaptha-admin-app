import type { FileUIPart } from "ai"

export type ChatModelOption = {
  description: string
  id: string
  name: string
}

export type ChatAttachment = FileUIPart & {
  id: string
  size: number
}

export const MAX_CHAT_FILE_SIZE = 10 * 1024 * 1024
export const MAX_CHAT_FILES = 5

export const CHAT_FILE_ACCEPT =
  "image/*,.txt,.md,.json,.csv,.xml,.yaml,.yml,.pdf,.doc,.docx"
