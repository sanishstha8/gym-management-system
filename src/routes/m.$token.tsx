import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Dumbbell } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useEffect } from "react"

import { AccessBadge } from "@/components/shared"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { portalQuery } from "@/data/queries"
import { memberQrPayload, PORTAL_TOKEN_KEY } from "@/lib/domain"
import { daysLeftLabel, formatDate, formatDateTime } from "@/lib/format"

export const Route = createFileRoute("/m/$token")({
  component: PortalPage,
})

function PortalPage() {
  const { token } = Route.useParams()
  const { data, isPending } = useQuery(portalQuery(token))

  useEffect(() => {
    if (!data) return
    try {
      localStorage.setItem(PORTAL_TOKEN_KEY, token)
    } catch {
      // storage blocked; gate check-in will ask the member to reopen this link
    }
  }, [data, token])

  return (
    <div className="flex min-h-svh justify-center bg-muted/40 px-4 py-8">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <div className="flex items-center gap-2 self-center font-semibold">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Dumbbell className="size-4" />
          </div>
          Shrawn Gym
        </div>
        {isPending ? (
          <Skeleton className="h-96 w-full rounded-xl" />
        ) : !data ? (
          <Card>
            <CardContent className="text-center text-sm text-muted-foreground">
              This member link is not valid. Ask the front desk for a new one.
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="flex flex-col items-center gap-4 text-center">
                <div>
                  <p className="font-heading text-xl font-semibold">{data.member.fullName}</p>
                  <p className="text-sm text-muted-foreground">{data.member.memberCode}</p>
                </div>
                {data.qrValue && (
                  <div className="rounded-xl bg-white p-4">
                    <QRCodeSVG value={memberQrPayload(data.qrValue)} size={220} marginSize={0} />
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Show this at the front desk scanner.</p>
                <div className="flex w-full items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
                  <span>
                    {data.planName ?? "No plan"} · until {formatDate(data.endDate)}
                  </span>
                  <AccessBadge access={data.access} />
                </div>
                <p className="text-sm font-medium">{daysLeftLabel(data.daysLeft)}</p>
              </CardContent>
            </Card>
            {data.recentVisits.length > 0 && (
              <Card>
                <CardContent>
                  <p className="mb-2 text-sm font-medium">Recent visits</p>
                  <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                    {data.recentVisits.map((v) => (
                      <li key={v}>{formatDateTime(v)}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            <p className="text-center text-xs text-muted-foreground">
              Keep this link private — it works like your membership card.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
