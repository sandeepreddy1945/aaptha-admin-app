import { RegistrationRequestsTable } from "@/components/registration-requests-table"

export default function DashboardNotificationsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">
      <RegistrationRequestsTable />
    </main>
  )
}
