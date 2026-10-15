import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowLeft, Maximize } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { api } from "@/data"
import { attendanceQuery } from "@/data/queries"
import { todayISO } from "@/lib/domain"
import { formatTime } from "@/lib/format"

export const Route = createFileRoute("/_app/checkin/gate")({
  component: GatePage,
})

/** Rotating gate code: members scan it with their phone to check themselves in. */
function GatePage() {
  const session = useQuery({
    queryKey: ["gate-session"],
    queryFn: () => api.createGateSession(),
    // Fetch a fresh code a few seconds before the current one expires.
    refetchInterval: (q) => (q.state.data ? Math.max(1000, Date.parse(q.state.data.expiresAt) - Date.now() - 3000) : 5000),
    staleTime: 0,
    gcTime: 0,
  })
  const today = todayISO()
  const feed = useQuery(attendanceQuery(today, today))
  const gateVisits = feed.data?.filter((a) => a.method === "gate").slice(0, 5) ?? []
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])

  const code = session.data?.code
  const remaining = session.data ? Math.max(0, Date.parse(session.data.expiresAt) - now) : 0
  const url = code ? `${window.location.origin}/gate/${code}` : ""

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link to="/checkin">
            <ArrowLeft data-icon="inline-start" />
            Check-in
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={() => void document.documentElement.requestFullscreen?.()}>
          <Maximize data-icon="inline-start" />
          Full screen
        </Button>
      </div>

      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5 rounded-2xl bg-hero p-8 text-center text-hero-foreground">
        <p className="text-[0.7rem] font-semibold tracking-[0.14em] text-lime uppercase">Scan to check in</p>
        <div className="rounded-xl bg-white p-4">
          {code ? (
            <QRCodeSVG value={url} size={240} marginSize={0} />
          ) : (
            <div className="size-60 animate-pulse rounded bg-muted" />
          )}
        </div>
        <p className="font-mono text-3xl font-semibold tracking-[0.3em] tabular-nums">{code ?? "······"}</p>
        <Progress value={(remaining / 60_000) * 100} className="w-48 bg-white/15 *:bg-lime" />
        <p className="text-sm text-hero-foreground/75">
          Open your member link on your phone once, then scan this code with your camera. It changes every minute.
        </p>
      </div>

      {gateVisits.length > 0 && (
        <ul className="mx-auto w-full max-w-md divide-y rounded-xl border">
          {gateVisits.map((a) => (
            <li key={a.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <span className="font-medium">{a.memberName ?? "Unknown"}</span>
              <span className={a.result === "accepted" ? "text-success" : "text-destructive"}>
                {a.result === "accepted" ? "Checked in" : a.denyReason}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">{formatTime(a.checkedInAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
