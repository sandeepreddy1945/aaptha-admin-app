"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { usePathname } from "next/navigation"
import {
  ensureInitialized,
  fetchAndActivate,
  getRemoteConfig,
  getString,
  getValue,
  isSupported,
} from "firebase/remote-config"

import { getFirebaseApp } from "@/lib/firebase"

const DEFAULT_QUESTIONS = [
  "What can you help me with?",
  "Present the monthly performance graph.",
  "Use an available MCP tool to inspect the current context.",
  "Summarize the information I provide in a file.",
]

const REMOTE_CONFIG_DEFAULTS = {
  organization_name: "Aaptha",
  organization_description: "",
  chatbot_title: "Ask Aaptha Elder Care",
  chatbot_page_description: "Chat with the Aaptha Elder Care assistant.",
  chatbot_welcome_description:
    "Welcome to Aaptha Elder Care. Ask a question and I’ll help you find the information you need.",
  chatbot_initial_questions: JSON.stringify(DEFAULT_QUESTIONS),
  dashboard_description:
    "Your account is signed in and ready. Review your profile and authentication details below.",
  profile_description:
    "Update your personal and contact details. Employee ID and Aadhaar are read-only.",
  profile_cache_ttl_hours: "6",
  notifications_description: "Review new user access requests.",
  notifications_page_description:
    "Review Aaptha Elder Care user access requests.",
  maps_description: "",
} as const

export type RemoteAppConfig = {
  organizationName: string
  organizationFullName: string
  organizationDescription: string
  dashboardBrand: string
  chatbotTitle: string
  chatbotPageDescription: string
  chatbotWelcomeDescription: string
  chatbotInitialQuestions: string[]
  dashboardDescription: string
  profileDescription: string
  profileCacheTtlHours: number
  notificationsDescription: string
  notificationsPageDescription: string
  mapsDescription: string
}

const DEFAULT_APP_CONFIG: RemoteAppConfig = {
  organizationName: REMOTE_CONFIG_DEFAULTS.organization_name,
  organizationFullName: "Aaptha Elder Care",
  organizationDescription: REMOTE_CONFIG_DEFAULTS.organization_description,
  dashboardBrand: "Aaptha Admin",
  chatbotTitle: REMOTE_CONFIG_DEFAULTS.chatbot_title,
  chatbotPageDescription: REMOTE_CONFIG_DEFAULTS.chatbot_page_description,
  chatbotWelcomeDescription: REMOTE_CONFIG_DEFAULTS.chatbot_welcome_description,
  chatbotInitialQuestions: [...DEFAULT_QUESTIONS],
  dashboardDescription: REMOTE_CONFIG_DEFAULTS.dashboard_description,
  profileDescription: REMOTE_CONFIG_DEFAULTS.profile_description,
  profileCacheTtlHours: 6,
  notificationsDescription: REMOTE_CONFIG_DEFAULTS.notifications_description,
  notificationsPageDescription:
    REMOTE_CONFIG_DEFAULTS.notifications_page_description,
  mapsDescription: REMOTE_CONFIG_DEFAULTS.maps_description,
}

const RemoteConfigContext = createContext<RemoteAppConfig>(DEFAULT_APP_CONFIG)

function parseQuestions(value: string) {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return [...DEFAULT_QUESTIONS]

    const questions = parsed
      .filter((question): question is string => typeof question === "string")
      .map((question) => question.trim())
      .filter(Boolean)
      .slice(0, 6)

    return questions.length > 0 ? questions : [...DEFAULT_QUESTIONS]
  } catch {
    return [...DEFAULT_QUESTIONS]
  }
}

function parseProfileCacheTtlHours(value: string) {
  const hours = Number(value)
  return Number.isFinite(hours) && hours >= 0 ? Math.min(hours, 24 * 365) : 6
}

function readRemoteAppConfig(): RemoteAppConfig {
  const remoteConfig = getRemoteConfig(getFirebaseApp())
  const getText = (key: keyof typeof REMOTE_CONFIG_DEFAULTS) =>
    getString(remoteConfig, key).trim() || REMOTE_CONFIG_DEFAULTS[key]
  const configuredOrganizationName =
    getValue(remoteConfig, "organization_name").getSource() === "remote"
      ? getString(remoteConfig, "organization_name").trim()
      : ""

  return {
    organizationName:
      configuredOrganizationName || REMOTE_CONFIG_DEFAULTS.organization_name,
    organizationFullName: configuredOrganizationName || "Aaptha Elder Care",
    organizationDescription: getText("organization_description"),
    dashboardBrand: configuredOrganizationName || "Aaptha Admin",
    chatbotTitle: getText("chatbot_title"),
    chatbotPageDescription: getText("chatbot_page_description"),
    chatbotWelcomeDescription: getText("chatbot_welcome_description"),
    chatbotInitialQuestions: parseQuestions(
      getText("chatbot_initial_questions")
    ),
    dashboardDescription: getText("dashboard_description"),
    profileDescription: getText("profile_description"),
    profileCacheTtlHours: parseProfileCacheTtlHours(
      getText("profile_cache_ttl_hours")
    ),
    notificationsDescription: getText("notifications_description"),
    notificationsPageDescription: getText("notifications_page_description"),
    mapsDescription: getText("maps_description"),
  }
}

function getPageMetadata(pathname: string, config: RemoteAppConfig) {
  if (pathname === "/chat" || pathname === "/dashboard/chat") {
    return {
      title: config.chatbotTitle,
      description: config.chatbotPageDescription,
    }
  }
  if (pathname === "/profile" || pathname === "/dashboard/profile") {
    return {
      title: `Profile · ${config.organizationName}`,
      description: config.profileDescription,
    }
  }
  if (
    pathname === "/notifications" ||
    pathname === "/dashboard/notifications"
  ) {
    return {
      title:
        config.organizationName === "Aaptha"
          ? "Registration notifications"
          : `Registration notifications · ${config.organizationName}`,
      description: config.notificationsPageDescription,
    }
  }
  if (pathname === "/maps") {
    return {
      title: `Maps · ${config.organizationName}`,
      description: config.mapsDescription,
    }
  }
  if (pathname === "/login") {
    return {
      title: `Sign in · ${config.organizationName}`,
      description: config.organizationDescription || "Sign in to your account",
    }
  }
  if (pathname === "/registration-pending") {
    return {
      title: `${config.organizationFullName} access`,
      description:
        config.organizationDescription ||
        "Your request is awaiting administrator approval.",
    }
  }

  return {
    title: config.organizationName,
    description: config.organizationDescription || config.dashboardDescription,
  }
}

export function RemoteConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState(DEFAULT_APP_CONFIG)
  const pathname = usePathname()

  useEffect(() => {
    let active = true

    async function loadConfig() {
      try {
        if (!(await isSupported())) return

        const remoteConfig = getRemoteConfig(getFirebaseApp())
        remoteConfig.defaultConfig = REMOTE_CONFIG_DEFAULTS
        remoteConfig.settings.minimumFetchIntervalMillis =
          process.env.NODE_ENV === "development" ? 0 : 60 * 60 * 1000
        remoteConfig.settings.fetchTimeoutMillis = 10_000
        await ensureInitialized(remoteConfig)

        if (active) setConfig(readRemoteAppConfig())

        try {
          await fetchAndActivate(remoteConfig)
        } catch {
          // Keep the bundled defaults or the last activated values when offline.
        }

        if (active) setConfig(readRemoteAppConfig())
      } catch {
        // The app remains usable with bundled copy when Remote Config is unavailable.
      }
    }

    void loadConfig()
    return () => {
      active = false
    }
  }, [])

  const pageMetadata = useMemo(
    () => getPageMetadata(pathname, config),
    [config, pathname]
  )

  useEffect(() => {
    document.title = pageMetadata.title
    let description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]'
    )
    if (!description) {
      description = document.createElement("meta")
      description.name = "description"
      document.head.append(description)
    }
    description.content = pageMetadata.description
  }, [pageMetadata])

  return (
    <RemoteConfigContext.Provider value={config}>
      {children}
    </RemoteConfigContext.Provider>
  )
}

export function useRemoteConfig() {
  return useContext(RemoteConfigContext)
}

export const REMOTE_CONFIG_KEYS = Object.keys(REMOTE_CONFIG_DEFAULTS)
