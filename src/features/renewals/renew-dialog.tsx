import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useState, type ReactNode } from "react"
import { toast } from "sonner"

import { AccessBadge, MemberAvatar } from "@/components/shared"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { plansQuery, useRenew } from "@/data/queries"
import { addDaysISO, renewalStartDate } from "@/lib/domain"
import { formatDate, formatNpr, paymentLabels } from "@/lib/format"
import type { MemberSummary, PaymentMethod } from "@/lib/types"

export function RenewDialog({ member, trigger }: { member: MemberSummary; trigger: ReactNode }) {
  const [open, setOpen] = useState(false)
  const { data: plans = [] } = useQuery(plansQuery)
  const activePlans = plans.filter((p) => p.active)
  const [planId, setPlanId] = useState<string | null>(null)
  const [amount, setAmount] = useState<string>("")
  const [method, setMethod] = useState<PaymentMethod>("cash")
  const renew = useRenew()

  const chosenId = planId ?? member.currentMembership?.planId ?? activePlans[0]?.id
  const plan = activePlans.find((p) => p.id === chosenId) ?? activePlans[0]
  const start = renewalStartDate(member.currentMembership)
  const end = plan ? addDaysISO(start, plan.durationDays - 1) : null
  const amountValue = amount === "" ? (plan?.priceNpr ?? 0) : Number(amount)

  function submit() {
    if (!plan) return
    renew.mutate(
      { memberId: member.id, planId: plan.id, amountNpr: amountValue, method },
      {
        onSuccess: () => {
          toast.success(`${member.fullName} renewed until ${formatDate(end)}`)
          setOpen(false)
          setPlanId(null)
          setAmount("")
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Renew membership</DialogTitle>
          <DialogDescription>Record the payment and extend access.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <MemberAvatar name={member.fullName} photoUrl={member.photoUrl} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{member.fullName}</p>
            <p className="text-xs text-muted-foreground">
              {member.planName ?? "No plan"} · ends {formatDate(member.currentMembership?.endDate)}
            </p>
          </div>
          <AccessBadge access={member.access} daysLeft={member.daysLeft} />
        </div>
        <FieldGroup>
          <Field>
            <FieldLabel>Plan</FieldLabel>
            <Select
              value={plan?.id}
              onValueChange={(v) => {
                setPlanId(v)
                setAmount("")
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a plan" />
              </SelectTrigger>
              <SelectContent>
                {activePlans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} · {p.durationDays} days · {formatNpr(p.priceNpr)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="renew-amount">Amount (NPR)</FieldLabel>
              <Input
                id="renew-amount"
                type="number"
                min={0}
                inputMode="numeric"
                value={amount === "" ? (plan?.priceNpr ?? "") : amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>Payment</FieldLabel>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(paymentLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </FieldGroup>
        {end && (
          <p className="rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
            New period: <strong>{formatDate(start)}</strong> → <strong>{formatDate(end)}</strong>
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!plan || renew.isPending || !(amountValue >= 0)}>
            {renew.isPending && <Loader2 className="animate-spin" />}
            Renew · {formatNpr(amountValue || 0)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
