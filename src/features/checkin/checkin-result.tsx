import { CircleAlert, CircleCheck, CircleX } from "lucide-react"

import { MemberAvatar } from "@/components/shared"
import { daysLeftLabel, formatDate, formatTime } from "@/lib/format"
import type { CheckInResult } from "@/lib/types"
import { cn } from "@/lib/utils"

const tone = {
  accepted: { icon: CircleCheck, title: "Welcome in", className: "border-success/30 bg-success/10 text-success" },
  denied: { icon: CircleX, title: "Access denied", className: "border-destructive/30 bg-destructive/10 text-destructive" },
  duplicate: { icon: CircleAlert, title: "Already checked in", className: "border-warning/40 bg-warning-soft text-warning" },
}

export function CheckInResultCard({ result, className }: { result: CheckInResult; className?: string }) {
  const t = tone[result.result]
  const renewSoon = result.result === "accepted" && result.daysLeft !== null && result.daysLeft <= 7

  return (
    <div role="status" aria-live="polite" className={cn("rounded-xl border p-4", t.className, className)}>
      <div className="flex items-center gap-3">
        <t.icon className="size-6 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-heading text-lg font-semibold">{t.title}</p>
          {result.reason && <p className="text-sm opacity-90">{result.reason}</p>}
        </div>
        <span className="text-xs tabular-nums opacity-80">{formatTime(result.at)}</span>
      </div>
      {result.member && (
        <div className="mt-3 flex items-center gap-3 rounded-lg bg-background/70 p-3 text-foreground">
          <MemberAvatar name={result.member.fullName} photoUrl={result.member.photoUrl} className="size-11" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{result.member.fullName}</p>
            <p className="text-xs text-muted-foreground">
              {result.member.memberCode} · {result.planName ?? "No plan"} · valid until {formatDate(result.endDate)}
            </p>
          </div>
          <span className="text-sm font-medium tabular-nums">{daysLeftLabel(result.daysLeft)}</span>
        </div>
      )}
      {renewSoon && (
        <p className="mt-2 text-sm font-medium text-warning">Renewal due soon — remind them at the desk.</p>
      )}
    </div>
  )
}
