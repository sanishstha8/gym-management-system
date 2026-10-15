import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { format } from "date-fns"
import { Bell, ScanLine } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { remindersQuery } from "@/data/queries"

export function SiteHeader() {
  const { data: reminders } = useQuery(remindersQuery)
  const pending = reminders?.filter((r) => r.status === "pending").length ?? 0

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
      <p className="hidden text-sm text-muted-foreground sm:block">{format(new Date(), "EEEE, d MMMM yyyy")}</p>
      <div className="ml-auto flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" asChild>
              <Link to="/renewals" aria-label={`${pending} renewal reminders pending`}>
                <Bell />
                {pending > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.625rem] font-semibold text-white">
                    {pending}
                  </span>
                )}
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Renewal reminders</TooltipContent>
        </Tooltip>
        <Button size="sm" asChild>
          <Link to="/checkin">
            <ScanLine data-icon="inline-start" />
            Check-in
          </Link>
        </Button>
      </div>
    </header>
  )
}
