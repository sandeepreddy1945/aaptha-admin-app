import { createMCPClient } from "@ai-sdk/mcp"
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  stepCountIs,
  streamText,
  toUIMessageStream,
  tool,
  type UIMessage,
} from "ai"
import { createOllama } from "ollama-ai-provider-v2"
import { z } from "zod"

import { getChatModelConfiguration } from "./model-config"
import { DummyGraphData } from "../components/dummy-graph-data"

const DEFAULT_MCP_SERVER_URL = "http://localhost:8000/mcp"
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434/api"
const SUPPORT_REPLY =
  "I’m sorry, but I couldn’t find a tool for that request. Please contact support for assistance."
const MCP_UNAVAILABLE_REPLY =
  "The FastMCP server is unavailable. Start the server and try again."

const mcpServerUrl = process.env.MCP_SERVER_URL ?? DEFAULT_MCP_SERVER_URL
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_BASE_URL
const reasoningEnabled = process.env.OLLAMA_ENABLE_REASONING === "true"
const ollama = createOllama({ baseURL: ollamaBaseUrl })

type McpClient = Awaited<ReturnType<typeof createMCPClient>>
type McpTools = Awaited<ReturnType<McpClient["tools"]>>
type McpResources = {
  client: McpClient
  tools: McpTools
}

type ChatRequest = {
  developerToolsEnabled?: boolean
  messages?: UIMessage[]
  model?: string
}

type ChatTools = McpTools & {
  presentGraph: typeof presentGraphTool
}

const presentGraphTool = tool({
  description:
    "Present the monthly performance graph when the user asks to show, display, render, plot, or present a graph or chart.",
  execute: async ({ title }) => DummyGraphData.getGraph(title),
  inputSchema: z.object({
    title: z.string().describe("Optional title for the graph").optional(),
  }),
})

const getMessageText = (message: UIMessage) =>
  message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join(" ")

const graphRequestPattern =
  /\b(?:show|present|display|render|plot|visuali[sz]e|create|generate|give me)\b[\s\S]{0,80}\b(?:graph|chart)\b|\b(?:graph|chart)\b[\s\S]{0,80}\b(?:show|present|display|render|plot|visuali[sz]e|create|generate|give me)\b/i

const isGraphRequest = (messages: UIMessage[]) => {
  const lastMessage = messages.at(-1)
  return (
    lastMessage?.role === "user" &&
    graphRequestPattern.test(getMessageText(lastMessage))
  )
}

let mcpResourcesPromise: Promise<McpResources> | undefined

const createFallbackResponse = (text: string) => {
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      const textId = generateId()
      writer.write({ type: "text-start", id: textId })
      writer.write({ type: "text-delta", id: textId, delta: text })
      writer.write({ type: "text-end", id: textId })
    },
  })

  return createUIMessageStreamResponse({ stream })
}

const initializeMcpResources = async (): Promise<McpResources> => {
  const client = await createMCPClient({
    transport: {
      type: "http",
      url: mcpServerUrl,
    },
  })

  try {
    const tools = await client.tools()
    return { client, tools }
  } catch (error) {
    await client.close().catch(() => undefined)
    throw error
  }
}

const getMcpResources = async () => {
  if (!mcpResourcesPromise) {
    mcpResourcesPromise = initializeMcpResources()
  }

  try {
    return await mcpResourcesPromise
  } catch (error) {
    mcpResourcesPromise = undefined
    throw error
  }
}

const getToolCatalog = (tools: ChatTools) =>
  Object.entries(tools)
    .map(([name, tool]) => {
      const description = (tool as { description?: unknown }).description
      return `- ${name}: ${typeof description === "string" ? description : "No description provided."}`
    })
    .join("\n")

const buildSystemPrompt = (tools?: ChatTools) => {
  if (!tools) {
    return "You are a helpful assistant. Developer tools are disabled, so answer directly and do not claim to have used external tools."
  }

  return `You are a helpful assistant connected to local presentation tools and a FastMCP server.

Follow these rules:
1. Match the user's intent to the available tool descriptions.
2. Call the best matching tool when the user asks for information or an action that a tool can provide.
3. When the user asks to show, present, display, render, plot, or create a graph or chart, call presentGraph.
4. Pass only values the user explicitly provided. Never invent, guess, or use placeholder values.
5. Use one best-matching tool at a time and do not invent tools.
6. If no available tool matches the request, reply exactly with:
${SUPPORT_REPLY}

Available tools:
${getToolCatalog(tools)}`
}

export async function handleChatRequest(request: Request) {
  let payload: ChatRequest
  try {
    payload = (await request.json()) as ChatRequest
  } catch {
    return Response.json({ error: "Invalid chat request." }, { status: 400 })
  }

  let modelConfiguration
  try {
    modelConfiguration = getChatModelConfiguration()
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to read Ollama model configuration.",
      },
      { status: 500 }
    )
  }

  if (
    !modelConfiguration.defaultModel ||
    modelConfiguration.models.length === 0
  ) {
    return Response.json(
      {
        error:
          "Configure OLLAMA_MODELS or OLLAMA_MODEL before starting a chat.",
      },
      { status: 503 }
    )
  }

  const requestedModel = payload.model ?? modelConfiguration.defaultModel
  if (!modelConfiguration.models.some((model) => model.id === requestedModel)) {
    return Response.json(
      { error: "The requested Ollama model is not configured." },
      { status: 400 }
    )
  }

  try {
    const messages = payload.messages ?? []
    const developerToolsEnabled = payload.developerToolsEnabled !== false
    const graphRequested = isGraphRequest(messages)

    let mcpTools: McpTools | undefined
    if (developerToolsEnabled && !graphRequested) {
      try {
        const resources = await getMcpResources()
        mcpTools = resources.tools
      } catch {
        return createFallbackResponse(MCP_UNAVAILABLE_REPLY)
      }
    }

    if (
      developerToolsEnabled &&
      !graphRequested &&
      Object.keys(mcpTools ?? {}).length === 0
    ) {
      return createFallbackResponse(MCP_UNAVAILABLE_REPLY)
    }

    const tools: ChatTools | undefined = developerToolsEnabled
      ? ({
          ...(mcpTools ?? {}),
          presentGraph: presentGraphTool,
        } as ChatTools)
      : undefined
    const modelMessages = await convertToModelMessages(messages)
    const result = streamText({
      model: ollama(requestedModel),
      system: buildSystemPrompt(tools),
      messages: modelMessages,
      stopWhen: stepCountIs(5),
      toolChoice: !developerToolsEnabled
        ? "none"
        : graphRequested
          ? { toolName: "presentGraph", type: "tool" }
          : "auto",
      tools,
      providerOptions: {
        ollama: {
          think: reasoningEnabled,
        },
      },
    })

    const stream = toUIMessageStream({
      onError: () => SUPPORT_REPLY,
      originalMessages: messages,
      sendReasoning: reasoningEnabled,
      stream: result.stream,
      tools,
    })

    return createUIMessageStreamResponse({ stream })
  } catch {
    return createFallbackResponse(MCP_UNAVAILABLE_REPLY)
  }
}
