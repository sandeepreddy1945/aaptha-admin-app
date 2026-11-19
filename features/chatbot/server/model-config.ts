import "server-only"

import { z } from "zod"

const modelCatalogSchema = z.array(
  z
    .object({
      id: z.string().trim().min(1).max(128),
      name: z.string().trim().min(1).max(120).optional(),
      description: z.string().trim().max(300).optional(),
    })
    .strict(),
)

export type ChatModelOption = {
  description: string
  id: string
  name: string
}

export type ChatModelConfiguration = {
  defaultModel: string | null
  models: ChatModelOption[]
}

export function getChatModelConfiguration(): ChatModelConfiguration {
  const configuredModels = process.env.OLLAMA_MODELS?.trim()
  const configuredDefault = process.env.OLLAMA_MODEL?.trim()
  let models: ChatModelOption[]

  if (configuredModels) {
    let rawModels: unknown
    try {
      rawModels = JSON.parse(configuredModels)
    } catch {
      throw new Error("OLLAMA_MODELS must contain a valid JSON array.")
    }

    const parsedModels = modelCatalogSchema.safeParse(rawModels)
    if (!parsedModels.success || parsedModels.data.length === 0) {
      throw new Error(
        "OLLAMA_MODELS must be a non-empty JSON array of model objects with an id.",
      )
    }

    models = parsedModels.data.map((model) => ({
      description: model.description ?? "",
      id: model.id,
      name: model.name ?? model.id,
    }))
  } else if (configuredDefault) {
    models = [
      {
        description: "",
        id: configuredDefault,
        name: configuredDefault,
      },
    ]
  } else {
    return { defaultModel: null, models: [] }
  }

  const modelIds = new Set(models.map(({ id }) => id))
  if (modelIds.size !== models.length) {
    throw new Error("OLLAMA_MODELS cannot contain duplicate model ids.")
  }

  if (configuredDefault && !modelIds.has(configuredDefault)) {
    throw new Error("OLLAMA_MODEL must match an id configured in OLLAMA_MODELS.")
  }

  return {
    defaultModel: configuredDefault ?? models[0]?.id ?? null,
    models,
  }
}
