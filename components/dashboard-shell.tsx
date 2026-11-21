"use client"

import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import type { ReactNode } from "react"
import { SunMoonIcon } from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { useRemoteConfig } from "@/components/remote-config-provider"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

function getPageTitle(pathname: string, chatbotTitle: string) {
  if (pathname.startsWith("/dashboard/profile")) return "Profile"
  if (pathname.startsWith("/dashboard/notifications")) {
    return "Registration notifications"
  }
  if (pathname.startsWith("/dashboard/chat")) return chatbotTitle

  return "Dashboard"
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const { chatbotTitle } = useRemoteConfig()
  const pageTitle = getPageTitle(pathname, chatbotTitle)

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-h-0">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator className="mr-2 h-4" orientation="vertical" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <Button
            aria-label="Toggle light and dark theme"
            className="ml-auto"
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
            size="icon"
            title="Toggle light and dark theme"
            type="button"
            variant="ghost"
          >
            <SunMoonIcon aria-hidden="true" />
          </Button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
