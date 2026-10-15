import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { BellRing, Mail, MessageSquare, MoreHorizontal, Play, RefreshCw, Wallet } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"

import { AccessBadge, EmptyState, ListSkeleton, MemberAvatar, PageHeader, StatCard } from "@/components/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  membersQuery,
  paymentsQuery,
  remindersQuery,
  settingsQuery,
  useDismissReminder,
  useGenerateReminders,
  useSendReminder,
} from "@/data/queries"
import { RenewDialog } from "@/features/renewals/renew-dialog"
import { daysBetween, reminderMessage, todayISO } from "@/lib/domain"
import { formatDate, formatDateTime, formatNpr, paymentLabels } from "@/lib/format"
import type { MemberSummary, ReminderKind, ReminderRow } from "@/lib/types"

const tabs = ["due", "expired", "reminders", "payments"] as const

export const Route = createFileRoute("/_app/renewals")({
  validateSearch: z.object({ tab: z.enum(tabs).optional() }),
  component: RenewalsPage,
})

function kindLabel(kind: ReminderKind) {
  if (kind === "due") return "Due today"
  if (kind === "overdue") return "Overdue"
  return `${kind.replace("d", "")} days before`
}

/** e.g. [7, 3, 0] → "Reminders are created 7 and 3 days before expiry, and on the expiry day." */
function reminderSchedule(days: number[]) {
  const before = days.filter((d) => d > 0).sort((a, b) => b - a)
  const parts: string[] = []
  if (before.length) parts.push(`${before.join(before.length > 2 ? ", " : " and ")} day${before.length === 1 && before[0] === 1 ? "" : "s"} before expiry`)
  if (days.includes(0)) parts.push("on the expiry day")
  return `Reminders are created ${parts.join(", and ")}, plus one overdue reminder after it lapses.`
}

function RenewalsPage() {
  const { tab = "due" } = Route.useSearch()
  const navigate = Route.useNavigate()
  const members = useQuery(membersQuery)
  const reminders = useQuery(remindersQuery)
  const settings = useQuery(settingsQuery)
  const today = todayISO()
  const monthStart = `${today.slice(0, 8)}01`
  const payments = useQuery(paymentsQuery(monthStart, today))
  const generate = useGenerateReminders()

  const due = (members.data ?? []).filter((m) => m.access === "expiring").sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0))
  const expired = (members.data ?? [])
    .filter((m) => m.access === "expired" && (m.daysLeft ?? 0) >= -60)
    .sort((a, b) => (b.daysLeft ?? 0) - (a.daysLeft ?? 0))
  const pending = reminders.data?.filter((r) => r.status === "pending") ?? []
  const dueValue = due.reduce((s, m) => s + (m.currentMembership?.amountNpr ?? 0), 0)
  const byId = new Map((members.data ?? []).map((m) => [m.id, m]))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Workspace"
        title="Renewals"
        description={settings.data ? reminderSchedule(settings.data.reminderDays) : " "}
        actions={
          <Button
            variant="outline"
            disabled={generate.isPending}
            onClick={() =>
              generate.mutate(undefined, {
                onSuccess: (n) => toast.success(n ? `${n} new reminder${n === 1 ? "" : "s"} created` : "Reminders are up to date"),
              })
            }
          >
            <Play data-icon="inline-start" />
            Run reminder check
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Due in 7 days" value={due.length} hint={`≈ ${formatNpr(dueValue)} expected`} icon={RefreshCw} loading={members.isPending} />
        <StatCard label="Recently expired" value={expired.length} hint="Last 60 days" icon={RefreshCw} loading={members.isPending} />
        <StatCard label="Pending reminders" value={pending.length} hint="Waiting to be sent" icon={BellRing} loading={reminders.isPending} />
        <StatCard
          label="Collected this month"
          value={payments.data && formatNpr(payments.data.reduce((s, p) => s + p.amountNpr, 0))}
          hint={`${payments.data?.length ?? 0} payments`}
          icon={Wallet}
          loading={payments.isPending}
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => navigate({ search: { tab: v as (typeof tabs)[number] }, replace: true })}>
        <TabsList>
          <TabsTrigger value="due">Due soon · {due.length}</TabsTrigger>
          <TabsTrigger value="expired">Expired · {expired.length}</TabsTrigger>
          <TabsTrigger value="reminders">Reminders · {pending.length}</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="due">
          <MemberList members={due} loading={members.isPending} empty="No memberships expiring in the next 7 days" />
        </TabsContent>
        <TabsContent value="expired">
          <MemberList members={expired} loading={members.isPending} empty="No recently expired memberships" />
        </TabsContent>
        <TabsContent value="reminders">
          <Card className="gap-0 overflow-hidden py-0">
            {reminders.isPending ? (
              <ListSkeleton />
            ) : !reminders.data?.length ? (
              <EmptyState icon={BellRing} title="No reminders yet">
                Reminders are created automatically each morning for memberships nearing expiry.
              </EmptyState>
            ) : (
              <ul className="divide-y">
                {reminders.data.map((r) => (
                  <ReminderItem
                    key={r.id}
                    reminder={r}
                    member={byId.get(r.memberId)}
                    gymName={settings.data?.gymName ?? "gym"}
                  />
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>
        <TabsContent value="payments">
          <Card className="gap-0 overflow-hidden py-0">
            {payments.isPending ? (
              <ListSkeleton />
            ) : !payments.data?.length ? (
              <EmptyState icon={Wallet} title="No payments this month yet" />
            ) : (
              <ul className="divide-y">
                {payments.data.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <Link to="/members/$memberId" params={{ memberId: p.memberId }} className="flex-1 font-medium hover:underline">
                      {p.memberName}
                    </Link>
                    <span className="hidden text-muted-foreground sm:inline">
                      {p.note ?? "Payment"} · {paymentLabels[p.method]}
                    </span>
                    <span className="text-muted-foreground tabular-nums">{formatDate(p.paidAt)}</span>
                    <span className="w-24 text-right font-medium tabular-nums">{formatNpr(p.amountNpr)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function MemberList({ members, loading, empty }: { members: MemberSummary[]; loading: boolean; empty: string }) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      {loading ? (
        <ListSkeleton />
      ) : members.length === 0 ? (
        <EmptyState icon={RefreshCw} title={empty} />
      ) : (
        <ul className="divide-y">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-4 py-3">
              <MemberAvatar name={m.fullName} photoUrl={m.photoUrl} />
              <div className="min-w-0 flex-1">
                <Link to="/members/$memberId" params={{ memberId: m.id }} className="truncate text-sm font-medium hover:underline">
                  {m.fullName}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {m.planName} · ends {formatDate(m.currentMembership?.endDate)} · {m.phone}
                </p>
              </div>
              <span className="hidden text-sm tabular-nums sm:inline">{formatNpr(m.currentMembership?.amountNpr ?? 0)}</span>
              <AccessBadge access={m.access} daysLeft={m.daysLeft} />
              <RenewDialog member={m} trigger={<Button size="sm">Renew</Button>} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function ReminderItem({ reminder: r, member, gymName }: { reminder: ReminderRow; member?: MemberSummary; gymName: string }) {
  const send = useSendReminder()
  const dismiss = useDismissReminder()
  const daysLeft = r.endDate ? daysBetween(todayISO(), r.endDate) : 0
  const message = reminderMessage(r.memberName, gymName, formatDate(r.endDate), daysLeft)

  const sendVia = (channel: "sms" | "email" | "in_app") =>
    send.mutate(
      { id: r.id, channel },
      { onSuccess: () => toast.success(channel === "in_app" ? "Marked as notified" : `${channel.toUpperCase()} sent to ${r.memberName}`) },
    )

  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/members/$memberId" params={{ memberId: r.memberId }} className="text-sm font-medium hover:underline">
            {r.memberName}
          </Link>
          <Badge variant={r.kind === "overdue" ? "destructive" : "secondary"}>{kindLabel(r.kind)}</Badge>
          {r.status === "sent" && (
            <Badge variant="outline" className="border-success/20 bg-success/10 text-success">
              Sent{r.channel !== "in_app" ? ` · ${r.channel.toUpperCase()}` : ""}
            </Badge>
          )}
          {r.status === "dismissed" && <Badge variant="outline">Dismissed</Badge>}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{message}</p>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{message}</TooltipContent>
        </Tooltip>
        <p className="text-xs text-muted-foreground">
          Ends {formatDate(r.endDate)} · created {formatDateTime(r.createdAt)}
          {r.sentAt && ` · sent ${formatDateTime(r.sentAt)}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {r.status === "pending" && (
          <>
            <Button size="sm" variant="outline" onClick={() => sendVia("sms")} disabled={send.isPending}>
              <MessageSquare data-icon="inline-start" />
              Send SMS
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => sendVia("email")}>
                  <Mail />
                  Send email
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => sendVia("in_app")}>
                  <BellRing />
                  Mark as told in person
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void navigator.clipboard.writeText(message).then(() => toast.success("Message copied"))}>
                  Copy message
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => dismiss.mutate(r.id)}>Dismiss</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
        {member && (member.access === "expiring" || member.access === "expired") && (
          <RenewDialog member={member} trigger={<Button size="sm">Renew</Button>} />
        )}
      </div>
    </li>
  )
}
