"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { useAuth } from "@/components/auth-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  CalendarClockIcon,
  CheckCircle2Icon,
  MailIcon,
  ShieldCheckIcon,
  UserRoundIcon,
} from "lucide-react"

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

function getProviderName(providerId?: string) {
  if (providerId === "google.com") return "Google"
  if (providerId === "password") return "Email and password"
  if (!providerId || providerId === "firebase") return "Firebase"

  return providerId.replace(/\.com$/, "")
}

export default function DashboardPage() {
  const { user } = useAuth()
  const name =
    user?.displayName?.trim() || user?.email?.split("@")[0] || "there"
  const email = user?.email ?? "Email unavailable"
  const initials = getInitials(name)
  const providerId = user?.providerData.find(
    (provider) => provider.providerId !== "firebase"
  )?.providerId
  const providerName = getProviderName(providerId)
  const isEmailVerified = user?.emailVerified ?? false
  const lastSignIn = user?.metadata.lastSignInTime ?? "Unavailable"

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Dashboard</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,1fr)]">
            <Card className="justify-center border-0 bg-primary text-primary-foreground ring-0">
              <CardContent className="flex flex-col gap-5 p-6 md:p-8">
                <Badge className="w-fit bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/20">
                  <ShieldCheckIcon data-icon="inline-start" />
                  Secure session active
                </Badge>
                <div className="space-y-2">
                  <p className="text-sm text-primary-foreground/75">
                    Aaptha Admin
                  </p>
                  <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                    Welcome back, {name}
                  </h1>
                  <p className="max-w-xl text-sm text-primary-foreground/75 md:text-base">
                    Your account is signed in and ready. Review your profile and
                    authentication details below.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Your profile</CardTitle>
                <CardDescription>
                  Details from your signed-in Firebase account.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex min-w-0 items-center gap-4">
                <Avatar size="lg" className="size-14">
                  <AvatarImage src={user?.photoURL ?? undefined} alt={name} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="grid min-w-0 gap-1">
                  <p className="truncate font-medium">{name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {email}
                  </p>
                  <Badge variant="secondary" className="mt-1 w-fit">
                    {providerName} sign-in
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-sm">Email address</CardTitle>
                  <CardDescription>Connected to your account</CardDescription>
                </div>
                <MailIcon className="size-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="font-medium break-all">{email}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-sm">Email verification</CardTitle>
                  <CardDescription>Firebase account status</CardDescription>
                </div>
                <CheckCircle2Icon className="size-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <Badge variant={isEmailVerified ? "secondary" : "outline"}>
                  {isEmailVerified ? "Verified" : "Not verified"}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-sm">Last sign-in</CardTitle>
                  <CardDescription>Reported by Firebase Auth</CardDescription>
                </div>
                <CalendarClockIcon className="size-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="font-medium break-all">{lastSignIn}</p>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRoundIcon className="size-4 text-muted-foreground" />
                Account details
              </CardTitle>
              <CardDescription>
                Profile information supplied by your sign-in provider.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Display name</p>
                <p className="font-medium">{name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium break-all">{email}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Sign-in provider
                </p>
                <p className="font-medium">{providerName}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Email status</p>
                <p className="font-medium">
                  {isEmailVerified ? "Verified" : "Not verified"}
                </p>
              </div>
            </CardContent>
          </Card>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
