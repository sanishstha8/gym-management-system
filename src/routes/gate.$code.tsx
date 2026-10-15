import { useMutation } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import { useEffect, useRef } from "react"

import { Card, CardContent } from "@/components/ui/card"
import { api } from "@/data"
import { CheckInResultCard } from "@/features/checkin/checkin-result"
import { PORTAL_TOKEN_KEY } from "@/lib/domain"

export const Route = createFileRoute("/gate/$code")({
  component: GateCheckInPage,
})

function readToken(): string | null {
  try {
    return localStorage.getItem(PORTAL_TOKEN_KEY)
  } catch {
    return null
  }
}

/** Opened on the member's phone after scanning the rotating gate QR. */
function GateCheckInPage() {
  const { code } = Route.useParams()
  const token = readToken()
  const checkIn = useMutation({ mutationFn: (t: string) => api.gateCheckIn(t, code) })
  const { mutate } = checkIn
  const started = useRef(false)

  useEffect(() => {
    // Guard so StrictMode's double effect doesn't log two visits.
    if (!token || started.current) return
    started.current = true
    mutate(token)
  }, [token, mutate])

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        {!token ? (
          <Card>
            <CardContent className="text-center text-sm">
              <p className="font-medium">Open your member link first</p>
              <p className="mt-1 text-muted-foreground">
                Ask the front desk for your personal link, open it once on this phone, then scan the gate code again.
              </p>
            </CardContent>
          </Card>
        ) : checkIn.data ? (
          <CheckInResultCard result={checkIn.data} />
        ) : checkIn.isError ? (
          <Card>
            <CardContent className="text-center text-sm text-destructive">{checkIn.error.message}</CardContent>
          </Card>
        ) : (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Checking you in…
          </div>
        )}
      </div>
    </div>
  )
}
