"use client"

import { signOut } from "firebase/auth"
import { ChevronsUpDownIcon, BellIcon, LogOutIcon, UserRoundIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { User } from "firebase/auth"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useAuth } from "@/components/auth-provider"
import { getFirebaseAuth } from "@/lib/firebase"

function getInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  )
}

export function NavUser({ user }: { user: User }) {
  const { isAdmin } = useAuth()
  const { isMobile } = useSidebar()
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const name = user.displayName?.trim() || user.email?.split("@")[0] || "User"
  const email = user.email ?? "Email unavailable"
  const initials = getInitials(name)

  useEffect(() => {
    if (!isAdmin) return

    let isActive = true
    const loadPendingCount = async () => {
      try {
        const response = await fetch(
          "/api/admin/registration-requests?countOnly=true",
          { cache: "no-store" },
        )
        if (!response.ok) return
        const payload: unknown = await response.json().catch(() => null)
        if (
          isActive &&
          typeof payload === "object" &&
          payload !== null &&
          "count" in payload &&
          typeof payload.count === "number"
        ) {
          setPendingCount(payload.count)
        }
      } catch {
        // Keep the last known notification count if the endpoint is unavailable.
      }
    }
    const refreshCount = () => void loadPendingCount()

    void loadPendingCount()
    const interval = window.setInterval(refreshCount, 30_000)
    window.addEventListener("registration-requests-updated", refreshCount)

    return () => {
      isActive = false
      window.clearInterval(interval)
      window.removeEventListener("registration-requests-updated", refreshCount)
    }
  }, [isAdmin])

  async function handleLogout() {
    setIsLoggingOut(true)
    setLogoutError(null)

    try {
      await signOut(getFirebaseAuth())
    } catch (error) {
      setLogoutError(
        error instanceof Error
          ? error.message
          : "Unable to sign out. Try again."
      )
      setIsLoggingOut(false)
    }
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton
                  size="lg"
                  className="aria-expanded:bg-muted"
                />
              }
            >
              <div className="relative shrink-0">
                <Avatar>
                  <AvatarImage src={user.photoURL ?? undefined} alt={name} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                {isAdmin && pendingCount > 0 && (
                  <span
                    aria-label={`${pendingCount} pending registration notifications`}
                    className="absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-5 font-semibold text-destructive-foreground"
                    role="status"
                  >
                    {pendingCount > 99 ? "99+" : pendingCount}
                  </span>
                )}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {email}
                </span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-64"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar>
                      <AvatarImage
                        src={user.photoURL ?? undefined}
                        alt={name}
                      />
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">{name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {email}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push("/profile")}>
                <UserRoundIcon />
                Profile
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem onClick={() => router.push("/notifications")}>
                  <BellIcon />
                  Notifications
                  {pendingCount > 0 && (
                    <span className="ml-auto rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground">
                      {pendingCount > 99 ? "99+" : pendingCount}
                    </span>
                  )}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={isLoggingOut}
                onClick={handleLogout}
                variant="destructive"
              >
                <LogOutIcon />
                {isLoggingOut ? "Signing out…" : "Log out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
      {logoutError && (
        <p className="px-2 text-xs text-destructive" role="alert">
          {logoutError}
        </p>
      )}
    </>
  )
}
