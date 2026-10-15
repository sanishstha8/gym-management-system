import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowLeft, Copy, ExternalLink, Pencil, Phone, Plus, RefreshCw, ScanLine } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { AccessBadge, EmptyState, MemberAvatar } from "@/components/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { addonsQuery, memberQuery, plansQuery, useAddNote, useAssignAddon, useEndAddon } from "@/data/queries"
import { useCheckIn } from "@/features/checkin/use-check-in"
import { CredentialsCard } from "@/features/members/credentials-card"
import { MemberFormDialog } from "@/features/members/member-form-dialog"
import { RenewDialog } from "@/features/renewals/renew-dialog"
import { daysBetween, toDateISO, todayISO } from "@/lib/domain"
import { formatDate, formatDateTime, formatNpr, methodLabels, paymentLabels } from "@/lib/format"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_app/members/$memberId")({
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(plansQuery)
    return context.queryClient.ensureQueryData(memberQuery(params.memberId))
  },
  component: MemberPage,
  errorComponent: () => (
    <EmptyState icon={ArrowLeft} title="Member not found">
      <Link to="/members" className="underline">
        Back to members
      </Link>
    </EmptyState>
  ),
})

function MemberPage() {
  const { memberId } = Route.useParams()
  const { data } = useSuspenseQuery(memberQuery(memberId))
  const [editing, setEditing] = useState(false)
  const checkIn = useCheckIn()
  const { member, memberships, payments, credentials, attendance, addons, notes } = data
  const current = member.currentMembership
  const portalUrl = `${window.location.origin}/m/${member.portalToken}`

  const total = current ? daysBetween(current.startDate, current.endDate) + 1 : 0
  const used = current ? Math.min(total, Math.max(0, daysBetween(current.startDate, todayISO()) + 1)) : 0
  const visits30 = attendance.filter(
    (a) => a.result === "accepted" && daysBetween(toDateISO(new Date(a.checkedInAt)), todayISO()) < 30,
  ).length

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="-ml-2 self-start" asChild>
        <Link to="/members">
          <ArrowLeft data-icon="inline-start" />
          Members
        </Link>
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <MemberAvatar name={member.fullName} photoUrl={member.photoUrl} className="size-16 text-lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{member.fullName}</h1>
            <AccessBadge access={member.access} daysLeft={member.daysLeft} />
          </div>
          <p className="text-sm text-muted-foreground">
            {member.memberCode} · Member since {formatDate(member.joinedOn)} · {visits30} visits in 30 days
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil data-icon="inline-start" />
            Edit
          </Button>
          <Button
            variant="outline"
            disabled={checkIn.isPending}
            onClick={() =>
              checkIn.mutate(
                { method: "assisted", value: member.id },
                {
                  onSuccess: (r) =>
                    r.result === "accepted"
                      ? toast.success(`${member.fullName} checked in`)
                      : r.result === "duplicate"
                        ? toast.info(r.reason)
                        : toast.error(r.reason),
                },
              )
            }
          >
            <ScanLine data-icon="inline-start" />
            Check in
          </Button>
          <RenewDialog
            member={member}
            trigger={
              <Button>
                <RefreshCw data-icon="inline-start" />
                Renew
              </Button>
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Membership</CardTitle>
              <CardDescription>
                {current
                  ? `${member.planName} · ${formatDate(current.startDate)} → ${formatDate(current.endDate)}`
                  : "No membership yet"}
              </CardDescription>
            </CardHeader>
            {current && (
              <CardContent className="flex flex-col gap-2">
                <Progress value={total ? (used / total) * 100 : 0} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {used} of {total} days used
                  </span>
                  <span>
                    {member.daysLeft !== null && member.daysLeft >= 0
                      ? `${member.daysLeft} day${member.daysLeft === 1 ? "" : "s"} left`
                      : `Expired ${formatDate(current.endDate)}`}
                  </span>
                </div>
              </CardContent>
            )}
            {memberships.length > 0 && (
              <CardContent>
                <ul className="divide-y rounded-lg border text-sm">
                  {memberships.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="font-medium">{m.planName}</span>
                      <span className="text-muted-foreground">
                        {formatDate(m.startDate)} → {formatDate(m.endDate)}
                      </span>
                      <span className="tabular-nums">{formatNpr(m.amountNpr)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <Detail label="Mobile">
                  <a href={`tel:${member.phone}`} className="inline-flex items-center gap-1 hover:underline">
                    <Phone className="size-3.5" />
                    {member.phone}
                  </a>
                </Detail>
                <Detail label="Email">{member.email ?? "—"}</Detail>
                <Detail label="Gender">
                  <span className="capitalize">{member.gender}</span>
                </Detail>
                <Detail label="Date of birth">{formatDate(member.dob)}</Detail>
                <Detail label="Emergency contact">{member.emergencyContact ?? "—"}</Detail>
                <Detail label="Status">
                  <span className="capitalize">{member.status}</span>
                </Detail>
                {member.notes && (
                  <Detail label="Notes" className="sm:col-span-2">
                    {member.notes}
                  </Detail>
                )}
              </dl>
            </CardContent>
          </Card>

          <Card className="gap-0 pb-0">
            <CardHeader className="border-b">
              <CardTitle>Recent visits</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {attendance.length === 0 ? (
                <EmptyState icon={ScanLine} title="No visits yet" />
              ) : (
                <ul className="max-h-80 divide-y overflow-y-auto">
                  {attendance.slice(0, 20).map((a) => (
                    <li key={a.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                      <span
                        className={cn("size-2 rounded-full", a.result === "accepted" ? "bg-success" : "bg-destructive")}
                      />
                      <span className="flex-1">{formatDateTime(a.checkedInAt)}</span>
                      <span className="text-muted-foreground">{a.denyReason ?? methodLabels[a.method]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 pb-0">
            <CardHeader className="border-b">
              <CardTitle>Payments</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <ul className="divide-y">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <span className="flex-1">{formatDate(p.paidAt)}</span>
                    <span className="text-muted-foreground">
                      {p.note ?? "Payment"} · {paymentLabels[p.method]}
                    </span>
                    <span className="font-medium tabular-nums">{formatNpr(p.amountNpr)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <CredentialsCard member={member} credentials={credentials} />

          <Card>
            <CardHeader>
              <CardTitle>Member portal</CardTitle>
              <CardDescription>
                Share this private link. Members see their QR, expiry, and can check in at the gate QR.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(portalUrl)
                  toast.success("Portal link copied")
                }}
              >
                <Copy data-icon="inline-start" />
                Copy link
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href={portalUrl} target="_blank" rel="noreferrer">
                  <ExternalLink data-icon="inline-start" />
                  Open
                </a>
              </Button>
            </CardContent>
          </Card>

          <AddonsCard memberId={member.id} addons={addons} />
          <NotesCard memberId={member.id} notes={notes} />
        </div>
      </div>

      {editing && <MemberFormDialog open onOpenChange={setEditing} member={member} />}
    </div>
  )
}

function Detail({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  )
}

function AddonsCard({
  memberId,
  addons,
}: {
  memberId: string
  addons: { id: string; addonId: string; addonName: string; priceNpr: number; startDate: string; endDate: string | null }[]
}) {
  const { data: catalog = [] } = useQuery(addonsQuery)
  const assign = useAssignAddon()
  const end = useEndAddon()
  const current = addons.filter((a) => !a.endDate)
  const available = catalog.filter((a) => a.active && !current.some((c) => c.addonId === a.id))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add-ons</CardTitle>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={available.length === 0}>
                <Plus data-icon="inline-start" />
                Add
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {available.map((a) => (
                <DropdownMenuItem key={a.id} onSelect={() => assign.mutate({ memberId, addonId: a.id })}>
                  {a.name} · {formatNpr(a.priceNpr)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent>
        {current.length === 0 ? (
          <p className="text-sm text-muted-foreground">No add-ons.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {current.map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-sm">
                <Badge variant="secondary">{a.addonName}</Badge>
                <span className="flex-1 text-xs text-muted-foreground">since {formatDate(a.startDate)}</span>
                <Button size="sm" variant="ghost" onClick={() => end.mutate(a.id)}>
                  End
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function NotesCard({ memberId, notes }: { memberId: string; notes: { id: string; note: string; createdAt: string }[] }) {
  const [text, setText] = useState("")
  const add = useAddNote()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Follow-up notes</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (text.trim()) add.mutate({ memberId, note: text }, { onSuccess: () => setText("") })
          }}
        >
          <Textarea
            rows={2}
            placeholder="Called about returning after exams…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="New note"
          />
          <Button size="sm" type="submit" variant="outline" className="self-end" disabled={!text.trim() || add.isPending}>
            Save note
          </Button>
        </form>
        {notes.map((n) => (
          <div key={n.id} className="rounded-lg bg-muted/60 p-2.5 text-sm">
            <p>{n.note}</p>
            <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
