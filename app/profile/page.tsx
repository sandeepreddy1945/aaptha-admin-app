"use client"

import { useEffect, useState } from "react"
import {
  useForm,
  type RegisterOptions,
  type UseFormRegister,
} from "react-hook-form"
import {
  CheckIcon,
  CopyIcon,
  LoaderCircleIcon,
  PencilIcon,
  SaveIcon,
  ShieldCheckIcon,
  XIcon,
} from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { useAuth } from "@/components/auth-provider"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Textarea } from "@/components/ui/textarea"

type ProfileFormValues = {
  firstName: string
  middleName: string
  lastName: string
  alternateEmail: string
  primaryPhone: string
  secondaryPhone: string
  address: string
}

type EditableProfileField = keyof ProfileFormValues

type ProfileResponse = ProfileFormValues & {
  employeeId: string
  aadhaarMasked: string
}

type EditableInputProps = {
  autoComplete: string
  editing: boolean
  error?: string
  label: string
  name: EditableProfileField
  onToggleEdit: () => void
  register: UseFormRegister<ProfileFormValues>
  type?: "email" | "tel" | "text"
}

const emptyProfile: ProfileFormValues = {
  firstName: "",
  middleName: "",
  lastName: "",
  alternateEmail: "",
  primaryPhone: "",
  secondaryPhone: "",
  address: "",
}

function EditableInput({
  autoComplete,
  editing,
  error,
  label,
  name,
  onToggleEdit,
  register,
  type = "text",
}: EditableInputProps) {
  const validation: RegisterOptions<ProfileFormValues, EditableProfileField> = {
    ...(name === "firstName" || name === "lastName"
      ? { required: `${label} is required.` }
      : {}),
    ...(name === "alternateEmail"
      ? {
          validate: (value) =>
            !value ||
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ||
            "Enter a valid email address.",
        }
      : {}),
    ...(name === "primaryPhone" || name === "secondaryPhone"
      ? {
          validate: (value) =>
            !value ||
            /^\+?[\d\s().-]{7,24}$/.test(value) ||
            "Enter a valid phone number.",
        }
      : {}),
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          {...register(name, validation)}
          id={name}
          type={type}
          autoComplete={autoComplete}
          readOnly={!editing}
          aria-invalid={Boolean(error)}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`${editing ? "Finish editing" : "Edit"} ${label.toLowerCase()}`}
          aria-pressed={editing}
          title={editing ? "Finish editing" : `Edit ${label.toLowerCase()}`}
          onClick={onToggleEdit}
        >
          {editing ? <CheckIcon /> : <PencilIcon />}
        </Button>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to save your profile."
}

export default function ProfilePage() {
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [employeeId, setEmployeeId] = useState("")
  const [aadhaarMasked, setAadhaarMasked] = useState("")
  const [copyMessage, setCopyMessage] = useState<string | null>(null)
  const [editingFields, setEditingFields] = useState<Set<EditableProfileField>>(
    () => new Set(),
  )
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProfileFormValues>({ defaultValues: emptyProfile })

  useEffect(() => {
    let isActive = true
    const nameParts = (user?.displayName ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)

    Promise.resolve()
      .then(() => fetch("/api/profile", { cache: "no-store" }))
      .then(async (response) => {
        const payload: unknown = await response.json().catch(() => null)
        if (!response.ok) {
          const message =
            typeof payload === "object" && payload !== null && "error" in payload
              ? String(payload.error)
              : "Unable to load your profile."
          throw new Error(message)
        }
        return payload as ProfileResponse
      })
      .then((profile) => {
        if (!isActive) return

        reset({
          firstName: profile.firstName || nameParts[0] || "",
          middleName: profile.middleName || "",
          lastName: profile.lastName || nameParts.slice(1).join(" "),
          alternateEmail: profile.alternateEmail || "",
          primaryPhone: profile.primaryPhone || "",
          secondaryPhone: profile.secondaryPhone || "",
          address: profile.address || "",
        })
        setEmployeeId(profile.employeeId || "")
        setAadhaarMasked(profile.aadhaarMasked || "")
        setLoadError(null)
        setIsLoading(false)
      })
      .catch((error: unknown) => {
        if (!isActive) return
        setLoadError(getErrorMessage(error))
        setIsLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [reset, user?.displayName, user?.uid])

  function toggleField(name: EditableProfileField) {
    setEditingFields((current) => {
      const next = new Set(current)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  async function copyEmployeeId() {
    if (!employeeId) return

    try {
      await navigator.clipboard.writeText(employeeId)
      setCopyMessage("Employee ID copied.")
    } catch {
      setCopyMessage("Copy failed. Select and copy the ID manually.")
    }
  }

  async function saveProfile(values: ProfileFormValues) {
    setSaveError(null)
    setSaveMessage(null)

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      const payload: unknown = await response.json().catch(() => null)

      if (!response.ok) {
        const message =
          typeof payload === "object" && payload !== null && "error" in payload
            ? String(payload.error)
            : "Unable to save your profile."
        throw new Error(message)
      }

      if (
        typeof payload !== "object" ||
        payload === null ||
        !("profile" in payload)
      ) {
        throw new Error("The server returned an invalid profile response.")
      }

      reset(payload.profile as ProfileFormValues)
      setEditingFields(new Set())
      setSaveMessage("Your profile has been saved.")
      setCopyMessage(null)
    } catch (error) {
      setSaveError(getErrorMessage(error))
    }
  }

  function cancelChanges() {
    reset()
    setEditingFields(new Set())
    setSaveError(null)
    setSaveMessage(null)
  }

  const firstNameError = errors.firstName?.message
  const middleNameError = errors.middleName?.message
  const lastNameError = errors.lastName?.message
  const alternateEmailError = errors.alternateEmail?.message
  const primaryPhoneError = errors.primaryPhone?.message
  const secondaryPhoneError = errors.secondaryPhone?.message
  const addressError = errors.address?.message

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
                <BreadcrumbPage>Profile</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 md:p-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
              <ShieldCheckIcon className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Update your personal and contact details. Employee ID and Aadhaar
              are read-only.
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit(saveProfile)}>
            <Card>
              <CardHeader>
                <CardTitle>Personal information</CardTitle>
                <CardDescription>
                  Select the pencil beside a field to edit it.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <EditableInput
                  autoComplete="given-name"
                  editing={editingFields.has("firstName")}
                  error={firstNameError}
                  label="First name"
                  name="firstName"
                  onToggleEdit={() => toggleField("firstName")}
                  register={register}
                />
                <EditableInput
                  autoComplete="additional-name"
                  editing={editingFields.has("middleName")}
                  error={middleNameError}
                  label="Middle name"
                  name="middleName"
                  onToggleEdit={() => toggleField("middleName")}
                  register={register}
                />
                <EditableInput
                  autoComplete="family-name"
                  editing={editingFields.has("lastName")}
                  error={lastNameError}
                  label="Last name"
                  name="lastName"
                  onToggleEdit={() => toggleField("lastName")}
                  register={register}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact information</CardTitle>
                <CardDescription>
                  Your primary email is managed by your sign-in provider.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="primaryEmail">Primary email</Label>
                  <Input
                    id="primaryEmail"
                    type="email"
                    autoComplete="email"
                    readOnly
                    value={user?.email ?? ""}
                    placeholder="No primary email on file"
                  />
                </div>
                <EditableInput
                  autoComplete="email"
                  editing={editingFields.has("alternateEmail")}
                  error={alternateEmailError}
                  label="Alternate email"
                  name="alternateEmail"
                  onToggleEdit={() => toggleField("alternateEmail")}
                  register={register}
                  type="email"
                />
                <EditableInput
                  autoComplete="tel"
                  editing={editingFields.has("primaryPhone")}
                  error={primaryPhoneError}
                  label="Primary phone"
                  name="primaryPhone"
                  onToggleEdit={() => toggleField("primaryPhone")}
                  register={register}
                  type="tel"
                />
                <EditableInput
                  autoComplete="tel"
                  editing={editingFields.has("secondaryPhone")}
                  error={secondaryPhoneError}
                  label="Secondary phone"
                  name="secondaryPhone"
                  onToggleEdit={() => toggleField("secondaryPhone")}
                  register={register}
                  type="tel"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Work and address</CardTitle>
                <CardDescription>
                  Employee ID and Aadhaar are protected read-only information.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="employeeId">Employee ID</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="employeeId"
                      disabled
                      value={employeeId || "Not assigned"}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!employeeId}
                      onClick={copyEmployeeId}
                    >
                      <CopyIcon data-icon="inline-start" />
                      Copy
                    </Button>
                  </div>
                  {copyMessage && (
                    <p className="text-xs text-muted-foreground" role="status">
                      {copyMessage}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="aadhaarNumber">Aadhaar number</Label>
                  <Input
                    id="aadhaarNumber"
                    disabled
                    value={aadhaarMasked || "Not on file"}
                  />
                  <p className="text-xs text-muted-foreground">
                    The number is masked and cannot be changed here.
                  </p>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <div className="flex items-start gap-2">
                    <Textarea
                      {...register("address", { maxLength: 1000 })}
                      id="address"
                      rows={3}
                      readOnly={!editingFields.has("address")}
                      aria-invalid={Boolean(addressError)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`${editingFields.has("address") ? "Finish editing" : "Edit"} address`}
                      aria-pressed={editingFields.has("address")}
                      title={editingFields.has("address") ? "Finish editing" : "Edit address"}
                      onClick={() => toggleField("address")}
                    >
                      {editingFields.has("address") ? <CheckIcon /> : <PencilIcon />}
                    </Button>
                  </div>
                  {addressError && (
                    <p className="text-sm text-destructive" role="alert">
                      {addressError}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {(loadError || saveError) && (
              <p className="text-sm text-destructive" role="alert">
                {loadError ?? saveError}
              </p>
            )}
            {saveMessage && (
              <p className="text-sm text-muted-foreground" role="status">
                {saveMessage}
              </p>
            )}

            {isDirty && (
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={cancelChanges}
                  disabled={isSubmitting}
                >
                  <XIcon data-icon="inline-start" />
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || isLoading}>
                  {isSubmitting ? (
                    <LoaderCircleIcon className="animate-spin" />
                  ) : (
                    <SaveIcon />
                  )}
                  Save changes
                </Button>
              </div>
            )}
          </form>

          {isLoading && (
            <p className="text-sm text-muted-foreground" role="status">
              Loading your profile…
            </p>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
