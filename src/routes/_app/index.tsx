import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  ArrowRight,
  CalendarCheck,
  ClipboardList,
  QrCode,
  RefreshCw,
  ScanLine,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import type { ReactNode } from "react"

import { AccessBadge, EmptyState, ListSkeleton, MemberAvatar, PageHeader, StatCard } from "@/components/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AssistedCheckInDialog } from "@/features/checkin/assisted-checkin-dialog"
import { WeekChart } from "@/features/dashboard/week-chart"
import { RenewDialog } from "@/features/renewals/renew-dialog"
import { attendanceQuery, dashboardQuery, membersQuery, settingsQuery } from "@/data/queries"
import { daysSinceVisit, needsFollowUp, todayISO } from "@/lib/domain"
import { formatDate, formatNpr, formatTime, methodLabels } from "@/lib/format"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_app/")({
  component: OverviewPage,
})

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}

function OverviewPage() {
  const today = todayISO()
  const stats = useQuery(dashboardQuery)
  const members = useQuery(membersQuery)
  const settings = useQuery(settingsQuery)
  const todayLog = useQuery(attendanceQuery(today, today))

  const followAfter = settings.data?.followUpAfterDays ?? 14
  const followUps = (members.data ?? [])
    .filter((m) => needsFollowUp(m, followAfter))
    .sort((a, b) => daysSinceVisit(a) - daysSinceVisit(b))
  const upcoming = (members.data ?? [])
    .filter((m) => m.access === "expiring" || (m.access === "expired" && (m.daysLeft ?? 0) >= -14))
    .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Workspace"
        title={`${greeting()}. Let's keep things moving.`}
        description="Your gym today — the people, visits and next steps."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/members" search={{ new: true }}>
                <UserPlus data-icon="inline-start" />
                Add member
              </Link>
            </Button>
            <AssistedCheckInDialog
              trigger={
                <Button>
                  <ScanLine data-icon="inline-start" />
                  Assisted check-in
                </Button>
              }
            />
          </>
        }
      />

      <section className="relative overflow-hidden rounded-2xl bg-hero p-6 text-hero-foreground sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -bottom-24 size-72 rounded-full border-[28px] border-white/5"
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-md">
            <p className="text-[0.7rem] font-semibold tracking-[0.14em] text-lime uppercase">
              Today at {settings.data?.gymName ?? "the gym"}
            </p>
            <h2 className="mt-2 font-heading text-xl font-semibold">A little follow-up can go a long way.</h2>
            <p className="mt-1 text-sm text-hero-foreground/75">
              Check in with members who have been away. A friendly call is a good place to start.
            </p>
            <Button className="mt-4 bg-lime text-lime-foreground hover:bg-lime/85" asChild>
              <Link to="/followups">
                <ArrowRight data-icon="inline-start" />
                View follow-up list
              </Link>
            </Button>
          </div>
          <div className="sm:text-right">
            <p className="font-heading text-5xl font-semibold text-lime tabular-nums">
              {members.isPending ? "–" : String(followUps.length).padStart(2, "0")}
            </p>
            <p className="text-sm text-hero-foreground/75">members need a follow-up</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Active members"
          value={stats.data?.activeMembers}
          hint="Eligible for gym access"
          icon={Users}
          loading={stats.isPending}
        />
        <StatCard
          label="Today's check-ins"
          value={stats.data?.todaysCheckIns}
          hint="Accepted visits today"
          icon={CalendarCheck}
          loading={stats.isPending}
        />
        <StatCard
          label="Renewals due"
          value={stats.data?.renewalsDue}
          hint="Within the next 7 days"
          icon={RefreshCw}
          loading={stats.isPending}
        />
        <StatCard
          label="Collected this month"
          value={stats.data && formatNpr(stats.data.collectedThisMonth)}
          hint="New + renewal payments"
          icon={Wallet}
          loading={stats.isPending}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card className="gap-0 pb-0">
            <CardHeader className="border-b">
              <CardTitle>People to check in with</CardTitle>
              <CardDescription>No visit in {followAfter}+ days. A supportive conversation starts here.</CardDescription>
              <CardAction>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/followups">View all</Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="px-0">
              {members.isPending ? (
                <ListSkeleton />
              ) : followUps.length === 0 ? (
                <EmptyState icon={Users} title="Everyone's been in recently">
                  Members who stop visiting will show up here.
                </EmptyState>
              ) : (
                <ul className="divide-y">
                  {followUps.slice(0, 4).map((m) => (
                    <Row key={m.id} name={m.fullName} photoUrl={m.photoUrl} sub={`Last visit: ${formatDate(m.lastVisit)}`}>
                      <Badge variant="outline" className="border-warning/30 bg-warning-soft text-warning">
                        {daysSinceVisit(m)} days away
                      </Badge>
                      <Button variant="outline" size="sm" asChild>
                        <Link to="/members/$memberId" params={{ memberId: m.id }}>
                          Review
                        </Link>
                      </Button>
                    </Row>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 pb-0">
            <CardHeader className="border-b">
              <CardTitle>Upcoming renewals</CardTitle>
              <CardDescription>Expiring within 7 days or recently lapsed.</CardDescription>
              <CardAction>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/renewals">View all</Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="px-0">
              {members.isPending ? (
                <ListSkeleton rows={3} />
              ) : upcoming.length === 0 ? (
                <EmptyState icon={RefreshCw} title="No renewals coming up" />
              ) : (
                <ul className="divide-y">
                  {upcoming.slice(0, 5).map((m) => (
                    <Row
                      key={m.id}
                      name={m.fullName}
                      photoUrl={m.photoUrl}
                      sub={`${m.planName} · ends ${formatDate(m.currentMembership?.endDate)}`}
                    >
                      <AccessBadge access={m.access} daysLeft={m.daysLeft} />
                      <RenewDialog
                        member={m}
                        trigger={
                          <Button variant="outline" size="sm">
                            Renew
                          </Button>
                        }
                      />
                    </Row>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>This week's attendance</CardTitle>
              <CardDescription>Accepted check-ins, last 7 days</CardDescription>
            </CardHeader>
            <CardContent>{stats.data ? <WeekChart week={stats.data.week} /> : <div className="h-44" />}</CardContent>
          </Card>

          <Card className="gap-0 pb-0">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-success" />
                </span>
                Live check-ins
              </CardTitle>
              <CardDescription>Card, QR and thumb scans as they happen</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {todayLog.isPending ? (
                <ListSkeleton rows={3} />
              ) : !todayLog.data?.length ? (
                <EmptyState icon={ScanLine} title="No check-ins yet today" />
              ) : (
                <ul className="divide-y">
                  {todayLog.data.slice(0, 6).map((a) => (
                    <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          a.result === "accepted" ? "bg-success" : "bg-destructive",
                        )}
                        aria-label={a.result}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{a.memberName ?? "Unknown credential"}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {methodLabels[a.method]}
                          {a.denyReason ? ` · ${a.denyReason}` : ""}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">{formatTime(a.checkedInAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <AssistedCheckInDialog
          trigger={
            <button type="button" className="text-left">
              <QuickTile icon={ScanLine} title="Assisted check-in" sub="Help a member record a visit" />
            </button>
          }
        />
        <Link to="/checkin/gate">
          <QuickTile icon={QrCode} title="Gate QR code" sub="Members scan with their phone" />
        </Link>
        <Link to="/attendance">
          <QuickTile icon={ClipboardList} title="Daily summary" sub="Review today's activity" />
        </Link>
      </div>
    </div>
  )
}

function Row({
  name,
  photoUrl,
  sub,
  children,
}: {
  name: string
  photoUrl: string | null
  sub: string
  children: ReactNode
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <MemberAvatar name={name} photoUrl={photoUrl} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{sub}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </li>
  )
}

function QuickTile({ icon: Icon, title, sub }: { icon: LucideIcon; title: string; sub: string }) {
  return (
    <div className="group flex h-full items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/50">
      <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{sub}</p>
      </div>
      <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </div>
  )
}
