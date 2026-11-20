import type { Metadata } from "next"

import { RegistrationRequestsTable } from "@/components/registration-requests-table"

export const metadata: Metadata = {
  title: "Registration notifications",
  description: "Review Aaptha Elder Care user access requests.",
}

export default function NotificationsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl p-4 md:p-8">
      <RegistrationRequestsTable />
    </main>
  )
}
