import { useQuery } from "@tanstack/react-query"
import { Link, useRouterState } from "@tanstack/react-router"
import {
  BellRing,
  CalendarCheck,
  Dumbbell,
  HeartHandshake,
  LayoutGrid,
  PackagePlus,
  ScanLine,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { api } from "@/data"
import { membersQuery, remindersQuery, settingsQuery } from "@/data/queries"
import { needsFollowUp } from "@/lib/domain"

import { UserMenu } from "./user-menu"

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  badge?: number
}

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const members = useQuery(membersQuery)
  const settings = useQuery(settingsQuery)
  const reminders = useQuery(remindersQuery)

  const followUps =
    members.data && settings.data
      ? members.data.filter((m) => needsFollowUp(m, settings.data.followUpAfterDays)).length
      : undefined
  const pendingReminders = reminders.data?.filter((r) => r.status === "pending").length

  const workspace: NavItem[] = [
    { to: "/", label: "Overview", icon: LayoutGrid },
    { to: "/checkin", label: "Check-in", icon: ScanLine },
    { to: "/followups", label: "Follow-up list", icon: HeartHandshake, badge: followUps },
    { to: "/members", label: "Members", icon: Users },
    { to: "/attendance", label: "Attendance", icon: CalendarCheck },
    { to: "/renewals", label: "Renewals", icon: BellRing, badge: pendingReminders },
    { to: "/addons", label: "Add-ons", icon: PackagePlus },
    { to: "/settings", label: "Settings", icon: Settings },
  ]

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to))

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Dumbbell className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold">{settings.data?.gymName ?? "Shrawn Gym"}</span>
                  <span className="truncate text-xs text-muted-foreground">Gym companion</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="tracking-[0.14em] uppercase">Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {workspace.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={isActive(item.to)} tooltip={item.label}>
                    <Link to={item.to}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                  {!!item.badge && <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {api.mode === "demo" && (
          <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
            <p className="mb-1 font-semibold tracking-[0.12em] text-primary uppercase">Demo mode</p>
            Fictional members, saved in this browser. Add Supabase keys to go live.
          </div>
        )}
        <UserMenu />
      </SidebarFooter>
    </Sidebar>
  )
}
