import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { useEffect } from "react"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { api } from "@/data"
import { invalidateTopics, profileQuery } from "@/data/queries"

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    const profile = await context.queryClient.ensureQueryData(profileQuery)
    if (!profile) throw redirect({ to: "/login", search: { redirect: location.href } })
    return { profile }
  },
  component: AppLayout,
})

function AppLayout() {
  const client = useQueryClient()

  // Live updates: check-ins from the kiosk, other staff, or the reminder job.
  useEffect(() => api.subscribe((topic) => void invalidateTopics(client, topic)), [client])

  // Reminders are generated daily by pg_cron in Supabase; the demo has no
  // server, so it catches up whenever the dashboard opens.
  useEffect(() => {
    if (api.mode !== "demo") return
    void api.generateReminders().then((n) => {
      if (n) void invalidateTopics(client, "reminders")
    })
  }, [client])

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
