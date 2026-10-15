import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { ChevronsUpDown, LogOut, Moon, RotateCcw, Sun } from "lucide-react"

import { MemberAvatar } from "@/components/shared"
import { useTheme } from "@/components/theme-provider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { api } from "@/data"
import { resetDemoData } from "@/data/demo/adapter"
import { profileQuery } from "@/data/queries"

export function UserMenu() {
  const { data: profile } = useQuery(profileQuery)
  const { resolvedTheme, setTheme } = useTheme()
  const client = useQueryClient()
  const navigate = useNavigate()

  async function signOut() {
    await api.signOut()
    client.clear()
    await navigate({ to: "/login" })
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg">
              <MemberAvatar name={profile?.fullName ?? "?"} className="size-8" />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{profile?.fullName}</span>
                <span className="truncate text-xs text-muted-foreground capitalize">{profile?.role}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium">{profile?.fullName}</p>
              <p className="text-xs text-muted-foreground">{profile?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
              {resolvedTheme === "dark" ? <Sun /> : <Moon />}
              {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
            </DropdownMenuItem>
            {api.mode === "demo" && (
              <DropdownMenuItem
                onSelect={() => {
                  resetDemoData()
                  void client.invalidateQueries()
                }}
              >
                <RotateCcw />
                Reset demo data
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={signOut}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
