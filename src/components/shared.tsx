import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { accessLabels, daysLeftLabel, initials } from "@/lib/format"
import type { AccessStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-[0.7rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function MemberAvatar({
  name,
  photoUrl,
  className,
}: {
  name: string
  photoUrl?: string | null
  className?: string
}) {
  return (
    <Avatar className={cn("size-9", className)}>
      {photoUrl && <AvatarImage src={photoUrl} alt="" />}
      <AvatarFallback className="bg-accent text-[0.7rem] font-semibold text-accent-foreground">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  )
}

const accessStyles: Record<AccessStatus, string> = {
  active: "bg-success/12 text-success border-success/20",
  expiring: "bg-warning-soft text-warning border-warning/30",
  expired: "bg-destructive/10 text-destructive border-destructive/20",
  frozen: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20",
  archived: "bg-muted text-muted-foreground border-border",
  none: "bg-muted text-muted-foreground border-border",
}

export function AccessBadge({ access, daysLeft }: { access: AccessStatus; daysLeft?: number | null }) {
  const showDays = daysLeft !== undefined && (access === "expiring" || access === "expired")
  return (
    <Badge variant="outline" className={cn("font-medium", accessStyles[access])}>
      {showDays ? daysLeftLabel(daysLeft ?? null) : accessLabels[access]}
    </Badge>
  )
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  loading,
}: {
  label: string
  value: ReactNode
  hint: string
  icon: LucideIcon
  loading?: boolean
}) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-muted-foreground">{label}</p>
          <Icon className="size-4 text-muted-foreground" aria-hidden />
        </div>
        {loading ? (
          <Skeleton className="mt-3 h-7 w-20" />
        ) : (
          <p className="mt-2 font-heading text-2xl font-semibold tabular-nums">{value}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icon className="size-5" aria-hidden />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {children && <div className="max-w-sm text-sm text-muted-foreground">{children}</div>}
    </div>
  )
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 p-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  )
}
