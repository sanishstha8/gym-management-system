import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Database, Pencil, Plus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { api } from "@/data"
import { plansQuery, profileQuery, settingsQuery, useSavePlan, useUpdateSettings } from "@/data/queries"
import { formatNpr } from "@/lib/format"
import type { GymSettings, Plan } from "@/lib/types"

export const Route = createFileRoute("/_app/settings")({
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQuery),
  component: SettingsPage,
})

function SettingsPage() {
  const { data: profile } = useQuery(profileQuery)
  const { data: settings } = useQuery(settingsQuery)
  const isOwner = profile?.role === "owner"

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description={isOwner ? "Gym profile, reminder rules and membership plans." : "Only the owner can change settings."}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {settings && <GeneralSettings key={JSON.stringify(settings)} settings={settings} disabled={!isOwner} />}
        <div className="flex flex-col gap-4">
          <PlansCard disabled={!isOwner} />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="size-4" />
                Backend
              </CardTitle>
              <CardDescription>
                {api.mode === "supabase"
                  ? "Connected to Supabase. Data is shared across devices in real time."
                  : "Demo mode: data lives in this browser only. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local to go live."}
              </CardDescription>
              <CardAction>
                <Badge variant={api.mode === "supabase" ? "default" : "secondary"}>
                  {api.mode === "supabase" ? "Supabase" : "Demo"}
                </Badge>
              </CardAction>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  )
}

function GeneralSettings({ settings, disabled }: { settings: GymSettings; disabled: boolean }) {
  const [gymName, setGymName] = useState(settings.gymName)
  const [reminderDays, setReminderDays] = useState(settings.reminderDays.join(", "))
  const [followUp, setFollowUp] = useState(String(settings.followUpAfterDays))
  const [dupWindow, setDupWindow] = useState(String(settings.duplicateWindowMinutes))
  const update = useUpdateSettings()

  const parsedDays = reminderDays
    .split(/[,\s]+/)
    .filter(Boolean)
    .map(Number)
  const daysValid = parsedDays.length > 0 && parsedDays.every((d) => Number.isInteger(d) && d >= 0 && d <= 60)

  return (
    <Card>
      <CardHeader>
        <CardTitle>General</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            update.mutate(
              {
                gymName: gymName.trim() || settings.gymName,
                reminderDays: parsedDays,
                followUpAfterDays: Math.max(1, Number(followUp) || 14),
                duplicateWindowMinutes: Math.max(0, Number(dupWindow) || 0),
              },
              { onSuccess: () => toast.success("Settings saved") },
            )
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="gym-name">Gym name</FieldLabel>
              <Input id="gym-name" value={gymName} onChange={(e) => setGymName(e.target.value)} disabled={disabled} />
            </Field>
            <Field data-invalid={!daysValid}>
              <FieldLabel htmlFor="reminder-days">Renewal reminders (days before expiry)</FieldLabel>
              <Input
                id="reminder-days"
                value={reminderDays}
                onChange={(e) => setReminderDays(e.target.value)}
                disabled={disabled}
                aria-invalid={!daysValid}
              />
              <FieldDescription>Comma separated. 0 means on the expiry day. Overdue reminders are added automatically.</FieldDescription>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="follow-up">Follow-up after (days)</FieldLabel>
                <Input
                  id="follow-up"
                  type="number"
                  min={1}
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                  disabled={disabled}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="dup-window">Ignore repeat scans for (min)</FieldLabel>
                <Input
                  id="dup-window"
                  type="number"
                  min={0}
                  value={dupWindow}
                  onChange={(e) => setDupWindow(e.target.value)}
                  disabled={disabled}
                />
              </Field>
            </div>
            {!disabled && (
              <Button type="submit" className="self-start" disabled={!daysValid || update.isPending}>
                Save settings
              </Button>
            )}
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

function PlansCard({ disabled }: { disabled: boolean }) {
  const { data: plans = [] } = useQuery(plansQuery)
  const [editing, setEditing] = useState<Partial<Plan> | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Membership plans</CardTitle>
        <CardDescription>Used when adding or renewing members.</CardDescription>
        {!disabled && (
          <CardAction>
            <Button size="sm" variant="outline" onClick={() => setEditing({ name: "", durationDays: 30, priceNpr: 0, active: true })}>
              <Plus data-icon="inline-start" />
              Plan
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-lg border">
          {plans.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="flex-1 font-medium">
                {p.name}
                {!p.active && (
                  <Badge variant="outline" className="ml-2">
                    Hidden
                  </Badge>
                )}
              </span>
              <span className="text-muted-foreground">{p.durationDays} days</span>
              <span className="w-24 text-right tabular-nums">{formatNpr(p.priceNpr)}</span>
              {!disabled && (
                <Button size="icon-sm" variant="ghost" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}>
                  <Pencil />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
      {editing && <PlanDialog plan={editing} onClose={() => setEditing(null)} />}
    </Card>
  )
}

function PlanDialog({ plan, onClose }: { plan: Partial<Plan>; onClose: () => void }) {
  const [name, setName] = useState(plan.name ?? "")
  const [days, setDays] = useState(String(plan.durationDays ?? 30))
  const [price, setPrice] = useState(String(plan.priceNpr ?? 0))
  const [active, setActive] = useState(plan.active ?? true)
  const save = useSavePlan()
  const valid = name.trim() && Number(days) > 0 && Number(price) >= 0

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{plan.id ? "Edit plan" : "New plan"}</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="plan-name">Name</FieldLabel>
            <Input id="plan-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="plan-days">Duration (days)</FieldLabel>
              <Input id="plan-days" type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="plan-price">Price (NPR)</FieldLabel>
              <Input id="plan-price" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
            </Field>
          </div>
          <Field orientation="horizontal">
            <Switch id="plan-active" checked={active} onCheckedChange={setActive} />
            <FieldLabel htmlFor="plan-active">Offer this plan</FieldLabel>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid || save.isPending}
            onClick={() =>
              save.mutate(
                { id: plan.id, name: name.trim(), durationDays: Number(days), priceNpr: Number(price), active },
                {
                  onSuccess: () => {
                    toast.success("Plan saved")
                    onClose()
                  },
                },
              )
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
