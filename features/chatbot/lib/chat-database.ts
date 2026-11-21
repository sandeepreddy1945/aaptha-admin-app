"use client"

import type { UIMessage } from "ai"
import {
  addRxPlugin,
  createRxDatabase,
  type RxCollection,
  type RxDatabase,
  type RxJsonSchema,
} from "rxdb"
import { RxDBMigrationPlugin } from "rxdb/plugins/migration-schema"
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie"

addRxPlugin(RxDBMigrationPlugin)

export const MAX_STORED_CONVERSATIONS = 10
export const MAX_STORED_MESSAGES = 60
export const MAX_STORED_PART_CHARS = 12_000

export type StoredConversation = {
  createdAt: number
  id: string
  messages: Record<string, unknown>[]
  title: string
  updatedAt: number
}

export type LoadedConversation = Omit<StoredConversation, "messages"> & {
  messages: UIMessage[]
}

type ChatCollections = {
  conversations: RxCollection<StoredConversation>
}

type ChatDatabase = RxDatabase<ChatCollections>

const conversationSchema: RxJsonSchema<StoredConversation> = {
  version: 1,
  primaryKey: "id",
  type: "object",
  properties: {
    createdAt: { type: "number" },
    id: { type: "string", maxLength: 120 },
    messages: {
      type: "array",
      items: { type: "object" },
      maxItems: MAX_STORED_MESSAGES,
    },
    title: { type: "string", maxLength: 200 },
    updatedAt: { type: "number" },
  },
  required: ["createdAt", "id", "messages", "title", "updatedAt"],
  indexes: ["updatedAt"],
}

const databasePromises = new Map<string, Promise<ChatDatabase>>()

let persistentStoragePromise: Promise<void> | undefined

const requestPersistentStorage = () => {
  if (!persistentStoragePromise) {
    persistentStoragePromise = (async () => {
      if (typeof navigator === "undefined" || !navigator.storage?.persist)
        return

      try {
        await navigator.storage.persist()
      } catch {
        // IndexedDB remains available if persistent storage is denied.
      }
    })()
  }

  return persistentStoragePromise
}

const getDatabase = async (userId: string): Promise<ChatDatabase> => {
  let databasePromise = databasePromises.get(userId)
  if (!databasePromise) {
    const databaseName = `aisdk_chat_${Array.from(userId, (character) =>
      character.codePointAt(0)?.toString(16)
    ).join("_")}`
    databasePromise = (async () => {
      await requestPersistentStorage()
      const database = await createRxDatabase<ChatCollections>({
        name: databaseName,
        storage: getRxStorageDexie(),
      })
      await database.addCollections({
        conversations: {
          migrationStrategies: {
            1: (oldDocument) => oldDocument,
          },
          schema: conversationSchema,
        },
      })
      return database
    })()
    databasePromises.set(userId, databasePromise)
  }

  return databasePromise
}

const truncate = (value: string) =>
  value.length > MAX_STORED_PART_CHARS
    ? `${value.slice(0, MAX_STORED_PART_CHARS)}…`
    : value

const limitValue = (value: unknown) => {
  if (typeof value === "string") {
    return truncate(value)
  }

  try {
    const serialized = JSON.stringify(value)
    return serialized.length > MAX_STORED_PART_CHARS
      ? `${serialized.slice(0, MAX_STORED_PART_CHARS)}…`
      : value
  } catch {
    return "[value omitted]"
  }
}

const sanitizeMessages = (messages: UIMessage[]) => {
  const serialized = JSON.parse(JSON.stringify(messages)) as Array<
    Record<string, unknown>
  >

  return serialized.slice(-MAX_STORED_MESSAGES).map((message) => ({
    ...message,
    parts: Array.isArray(message.parts)
      ? message.parts.map((part) => {
          if (typeof part !== "object" || part === null) {
            return part
          }

          const safePart = { ...(part as Record<string, unknown>) }
          if (typeof safePart.text === "string") {
            safePart.text = truncate(safePart.text)
          }
          if (typeof safePart.url === "string") {
            safePart.url = safePart.url.startsWith("data:") ? "" : safePart.url
          }
          if ("input" in safePart) {
            safePart.input = limitValue(safePart.input)
          }
          if ("output" in safePart) {
            safePart.output = limitValue(safePart.output)
          }
          return safePart
        })
      : [],
  }))
}

const pruneConversations = async (
  collection: RxCollection<StoredConversation>
) => {
  const conversations = await collection
    .find()
    .sort({ updatedAt: "desc" })
    .exec()

  await Promise.all(
    conversations
      .slice(MAX_STORED_CONVERSATIONS)
      .map((conversation) => conversation.remove())
  )
}

export const createConversationId = () =>
  `conversation-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

export const getConversationTitle = (messages: UIMessage[]) => {
  const firstUserMessage = messages.find((message) => message.role === "user")
  const text = firstUserMessage?.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join(" ")
    .trim()

  return text ? truncate(text) : "Ask Aaptha Elder Care"
}

export const loadLatestConversation = async (
  userId: string
): Promise<LoadedConversation | null> => {
  if (!userId) return null

  try {
    const database = await getDatabase(userId)
    const [conversation] = await database.conversations
      .find()
      .sort({ updatedAt: "desc" })
      .limit(1)
      .exec()

    if (!conversation) {
      return null
    }

    const { messages: storedMessages, ...metadata } = conversation.toJSON()

    return {
      ...metadata,
      messages: storedMessages as unknown as UIMessage[],
    }
  } catch {
    return null
  }
}

export const saveConversation = async ({
  userId,
  id,
  messages,
}: {
  userId: string
  id: string
  messages: UIMessage[]
}) => {
  if (!userId) return

  try {
    const database = await getDatabase(userId)
    const collection = database.conversations
    const existing = await collection.findOne(id).exec()
    const now = Date.now()

    await collection.upsert({
      createdAt: existing?.createdAt ?? now,
      id,
      messages: sanitizeMessages(messages),
      title: getConversationTitle(messages),
      updatedAt: now,
    })
    await pruneConversations(collection)
  } catch {
    // Persistence is best-effort and should never block the chat.
  }
}
