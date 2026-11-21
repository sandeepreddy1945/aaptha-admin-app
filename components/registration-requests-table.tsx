"use client"

import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckIcon, EyeIcon, LoaderCircleIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useRemoteConfig } from "@/components/remote-config-provider"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type RegistrationRequest = {
  displayName: string
  email: string
  emailVerified: boolean
  phoneNumber: string
  photoURL: string
  providers: string[]
  requestedAt: string
  uid: string
}

type Action = "approve" | "reject"
type AssignableRole = "admin" | "hr"

const registrationTableFeatures = tableFeatures({})
const registrationColumnHelper = createColumnHelper<
  typeof registrationTableFeatures,
  RegistrationRequest
>()

function formatDate(value: string) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString()
}

export function RegistrationRequestsTable() {
  const { notificationsDescription } = useRemoteConfig()
  const [requests, setRequests] = useState<RegistrationRequest[]>([])
  const [selectedRequest, setSelectedRequest] =
    useState<RegistrationRequest | null>(null)
  const [selectedRoles, setSelectedRoles] = useState<AssignableRole[]>([])
  const [action, setAction] = useState<Action | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadRequests = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/registration-requests", {
        cache: "no-store",
      })
      const payload: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const message =
          typeof payload === "object" && payload !== null && "error" in payload
            ? String(payload.error)
            : "Unable to load registration notifications."
        throw new Error(message)
      }
      if (
        typeof payload !== "object" ||
        payload === null ||
        !("requests" in payload) ||
        !Array.isArray(payload.requests)
      ) {
        throw new Error("The registration response was invalid.")
      }

      setError(null)
      setRequests(payload.requests as RegistrationRequest[])
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load registration notifications."
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadRequests(), 0)
    return () => window.clearTimeout(initialLoad)
  }, [loadRequests])

  const handleView = useCallback((request: RegistrationRequest) => {
    setSelectedRoles([])
    setSelectedRequest(request)
    setError(null)
  }, [])

  const columns = useMemo(
    () =>
      registrationColumnHelper.columns([
        registrationColumnHelper.accessor("displayName", {
          header: "Name",
          cell: ({ row }) =>
            row.original.displayName ||
            row.original.email ||
            "Name unavailable",
        }),
        registrationColumnHelper.accessor("email", {
          header: "Email",
        }),
        registrationColumnHelper.accessor("requestedAt", {
          header: "Requested",
          cell: ({ row }) => formatDate(row.original.requestedAt),
        }),
        registrationColumnHelper.display({
          id: "actions",
          header: "Details",
          cell: ({ row }) => (
            <Button
              onClick={() => handleView(row.original)}
              size="sm"
              type="button"
              variant="outline"
            >
              <EyeIcon />
              View
            </Button>
          ),
        }),
      ]),
    [handleView]
  )
  const table = useTable({
    features: registrationTableFeatures,
    data: requests,
    columns,
    getRowId: (row) => row.uid,
  })

  const handleAction = async (nextAction: Action) => {
    if (!selectedRequest || action) return
    if (nextAction === "approve" && selectedRoles.length === 0) {
      setError("Select at least one role before approving this request.")
      return
    }

    const assignedRoles = [...selectedRoles]
    setAction(nextAction)
    setError(null)
    setNotice(null)

    try {
      const response = await fetch("/api/admin/registration-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: nextAction,
          uid: selectedRequest.uid,
          ...(nextAction === "approve" ? { roles: assignedRoles } : {}),
        }),
      })
      const payload: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const message =
          typeof payload === "object" && payload !== null && "error" in payload
            ? String(payload.error)
            : "Unable to update the registration request."
        throw new Error(message)
      }

      const employeeId =
        typeof payload === "object" &&
        payload !== null &&
        "employeeId" in payload
          ? String(payload.employeeId ?? "")
          : ""
      setSelectedRequest(null)
      setSelectedRoles([])
      setNotice(
        nextAction === "approve"
          ? `${selectedRequest.displayName || selectedRequest.email} approved · ${assignedRoles.join(", ")} role${assignedRoles.length === 1 ? "" : "s"}${employeeId ? ` · Employee ID ${employeeId}` : ""}.`
          : `${selectedRequest.displayName || selectedRequest.email} request rejected.`
      )
      window.dispatchEvent(new Event("registration-requests-updated"))
      await loadRequests()
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to update the registration request."
      )
    } finally {
      setAction(null)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Registration notifications</h1>
          <p className="text-sm text-muted-foreground">
            {notificationsDescription}
          </p>
        </div>
        <Button
          disabled={isLoading}
          onClick={() => {
            setIsLoading(true)
            void loadRequests()
          }}
          type="button"
          variant="outline"
        >
          {isLoading && <LoaderCircleIcon className="animate-spin" />}
          Refresh
        </Button>
      </div>

      {notice && (
        <p
          className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm"
          role="status"
        >
          {notice}
        </p>
      )}
      {error && (
        <p
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  className="h-24 text-center"
                  colSpan={columns.length}
                >
                  Loading registration requests…
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  className="h-24 text-center text-muted-foreground"
                  colSpan={columns.length}
                >
                  No pending registration requests.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        onOpenChange={(open) => {
          if (!open && !action) setSelectedRequest(null)
        }}
        open={Boolean(selectedRequest)}
      >
        <DialogContent className="sm:max-w-lg">
          {selectedRequest && (
            <>
              <DialogHeader>
                <DialogTitle>User registration request</DialogTitle>
                <DialogDescription>
                  Review the account details before approving access.
                </DialogDescription>
              </DialogHeader>
              <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-4 gap-y-3 text-sm">
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-medium wrap-break-word">
                  {selectedRequest.displayName || "Not provided"}
                </dd>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="break-all">
                  {selectedRequest.email || "Not provided"}
                </dd>
                <dt className="text-muted-foreground">Email verified</dt>
                <dd>{selectedRequest.emailVerified ? "Yes" : "No"}</dd>
                <dt className="text-muted-foreground">Phone</dt>
                <dd>{selectedRequest.phoneNumber || "Not provided"}</dd>
                <dt className="text-muted-foreground">Sign-in provider</dt>
                <dd>
                  {selectedRequest.providers.join(", ") || "Not available"}
                </dd>
                <dt className="text-muted-foreground">Requested</dt>
                <dd>{formatDate(selectedRequest.requestedAt)}</dd>
                <dt className="text-muted-foreground">Firebase UID</dt>
                <dd className="font-mono text-xs break-all">
                  {selectedRequest.uid}
                </dd>
              </dl>
              <fieldset className="space-y-2 rounded-md border p-3">
                <legend className="px-1 text-sm font-medium">
                  Assign access roles
                </legend>
                <p className="text-xs text-muted-foreground">
                  Select one or both roles. Only admin or HR accounts can access
                  the application.
                </p>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {(["hr", "admin"] as const).map((role) => (
                    <label
                      className="flex items-center gap-2 text-sm"
                      key={role}
                    >
                      <input
                        checked={selectedRoles.includes(role)}
                        className="size-4 accent-primary"
                        onChange={(event) => {
                          setSelectedRoles((current) =>
                            event.target.checked
                              ? [...current, role]
                              : current.filter(
                                  (selectedRole) => selectedRole !== role
                                )
                          )
                          setError(null)
                        }}
                        type="checkbox"
                      />
                      {role === "hr" ? "HR" : "Admin"}
                    </label>
                  ))}
                </div>
              </fieldset>
              <DialogFooter className="sm:justify-between">
                <Button
                  disabled={action !== null}
                  onClick={() => void handleAction("reject")}
                  type="button"
                  variant="destructive"
                >
                  {action === "reject" ? (
                    <LoaderCircleIcon className="animate-spin" />
                  ) : (
                    <XIcon />
                  )}
                  Reject
                </Button>
                <Button
                  disabled={action !== null || selectedRoles.length === 0}
                  onClick={() => void handleAction("approve")}
                  type="button"
                >
                  {action === "approve" ? (
                    <LoaderCircleIcon className="animate-spin" />
                  ) : (
                    <CheckIcon />
                  )}
                  Approve
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
