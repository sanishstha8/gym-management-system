import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { CreditCard, Fingerprint, QrCode, ScanLine, UserRound } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { z } from "zod"

import { EmptyState, PageHeader } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api } from "@/data"
import { attendanceQuery } from "@/data/queries"
import { AssistedCheckInDialog } from "@/features/checkin/assisted-checkin-dialog"
import { CheckInResultCard } from "@/features/checkin/checkin-result"
import { QrScanner } from "@/features/checkin/qr-scanner"
import { useCheckIn } from "@/features/checkin/use-check-in"
import { FingerprintPad } from "@/features/members/fingerprint-pad"
import { MemberPicker } from "@/features/members/member-picker"
import { parseMemberQr, todayISO } from "@/lib/domain"
import { formatTime, methodLabels } from "@/lib/format"
import type { CredentialType } from "@/lib/types"
import { cn } from "@/lib/utils"

const modes = ["card", "qr", "fingerprint"] as const

export const Route = createFileRoute("/_app/checkin/")({
  validateSearch: z.object({ mode: z.enum(modes).optional() }),
  component: CheckInPage,
})

/** How long a result stays on screen before the kiosk resets. */
const RESULT_TIMEOUT_MS = 8000

function CheckInPage() {
  const { mode = "card" } = Route.useSearch()
  const navigate = Route.useNavigate()
  const checkIn = useCheckIn()
  const today = todayISO()
  const feed = useQuery(attendanceQuery(today, today))
  const [simulate, setSimulate] = useState<CredentialType | null>(null)

  const { data: result, reset } = checkIn
  useEffect(() => {
    if (!result) return
    const t = setTimeout(reset, RESULT_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [result, reset])

  const run = (method: CredentialType, value: string) => checkIn.mutate({ method, value })

  /** Demo helper: look up a member's enrolled credential and "scan" it. */
  async function simulateFor(memberId: string, type: CredentialType) {
    setSimulate(null)
    const detail = await api.getMember(memberId)
    const credential = detail.credentials.find((c) => c.type === type && c.active)
    if (credential) run(type, credential.value)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Front desk"
        title="Check-in"
        description="Members tap a card, show their QR code, or scan a thumb. Every visit is logged."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/checkin/gate">
                <QrCode data-icon="inline-start" />
                Gate QR screen
              </Link>
            </Button>
            <AssistedCheckInDialog
              trigger={
                <Button variant="outline">
                  <UserRound data-icon="inline-start" />
                  Assisted
                </Button>
              }
            />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardContent>
            <Tabs value={mode} onValueChange={(v) => navigate({ search: { mode: v as CredentialType }, replace: true })}>
              <TabsList className="w-full">
                <TabsTrigger value="card">
                  <CreditCard />
                  Card
                </TabsTrigger>
                <TabsTrigger value="qr">
                  <QrCode />
                  QR code
                </TabsTrigger>
                <TabsTrigger value="fingerprint">
                  <Fingerprint />
                  Thumb
                </TabsTrigger>
              </TabsList>

              <TabsContent value="card" className="pt-6">
                <CardReader onRead={(uid) => run("card", uid)} busy={checkIn.isPending} />
                <SimulateLink onClick={() => setSimulate("card")}>Simulate a card tap</SimulateLink>
              </TabsContent>

              <TabsContent value="qr" className="flex flex-col items-center gap-4 pt-6">
                <QrScanner
                  paused={checkIn.isPending}
                  onDecode={(text) => {
                    const token = parseMemberQr(text)
                    run("qr", token ?? text)
                  }}
                />
                <ManualQr onSubmit={(text) => run("qr", parseMemberQr(text) ?? text)} />
                <SimulateLink onClick={() => setSimulate("qr")}>Simulate a QR scan</SimulateLink>
              </TabsContent>

              <TabsContent value="fingerprint" className="flex flex-col items-center gap-4 pt-6">
                <FingerprintPad
                  label="Place thumb"
                  disabled={checkIn.isPending}
                  onScan={() => setSimulate("fingerprint")}
                />
                <p className="max-w-sm text-center text-sm text-muted-foreground">
                  Simulated sensor: hold the pad, then choose whose thumb it is. A real reader sends the matched
                  fingerprint id straight to the same check-in API.
                </p>
                <Button variant="ghost" size="sm" onClick={() => run("fingerprint", "FP-UNKNOWN")}>
                  Simulate an unknown finger
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4 lg:col-span-2">
          {checkIn.data ? (
            <CheckInResultCard result={checkIn.data} />
          ) : (
            <div className="flex min-h-36 items-center justify-center rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              {checkIn.isPending ? "Checking…" : "Waiting for the next scan"}
            </div>
          )}

          <Card className="gap-0 pb-0">
            <CardHeader className="border-b">
              <CardTitle>Today's log</CardTitle>
              <CardDescription>
                {feed.data?.filter((a) => a.result === "accepted").length ?? 0} accepted ·{" "}
                {feed.data?.filter((a) => a.result === "denied").length ?? 0} denied
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {!feed.data?.length ? (
                <EmptyState icon={ScanLine} title="No scans yet today" />
              ) : (
                <ul className="max-h-96 divide-y overflow-y-auto">
                  {feed.data.slice(0, 30).map((a) => (
                    <li key={a.id} className="flex items-center gap-3 px-4 py-2">
                      <span
                        className={cn("size-2 rounded-full", a.result === "accepted" ? "bg-success" : "bg-destructive")}
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

      <Dialog open={simulate !== null} onOpenChange={(o) => !o && setSimulate(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {simulate === "fingerprint" ? "Whose thumb is on the sensor?" : "Simulate a scan"}
            </DialogTitle>
            <DialogDescription>
              Pick a member with an enrolled {simulate === "card" ? "card" : simulate === "qr" ? "QR code" : "thumbprint"}.
            </DialogDescription>
          </DialogHeader>
          {simulate && (
            <MemberPicker
              filter={(m) => m.credentialTypes.includes(simulate)}
              onSelect={(m) => void simulateFor(m.id, simulate)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * USB RFID readers behave like keyboards: they type the UID and press Enter.
 * Keep the input focused so a tap is captured even if staff clicked elsewhere.
 */
function CardReader({ onRead, busy }: { onRead: (uid: string) => void; busy: boolean }) {
  const [uid, setUid] = useState("")
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const refocus = () => {
      const active = document.activeElement
      if (!active || active === document.body) ref.current?.focus()
    }
    const t = setInterval(refocus, 1000)
    ref.current?.focus()
    return () => clearInterval(t)
  }, [])

  return (
    <form
      className="mx-auto flex max-w-sm flex-col items-center gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!uid.trim()) return
        onRead(uid.trim())
        setUid("")
      }}
    >
      <div className="flex size-28 items-center justify-center rounded-2xl bg-accent text-primary">
        <CreditCard className="size-12" strokeWidth={1.4} />
      </div>
      <Field>
        <FieldLabel htmlFor="card-input" className="sr-only">
          Card UID
        </FieldLabel>
        <Input
          id="card-input"
          ref={ref}
          autoComplete="off"
          placeholder="Tap card on reader…"
          className="h-11 text-center font-mono text-lg uppercase placeholder:font-sans placeholder:text-base placeholder:normal-case"
          value={uid}
          disabled={busy}
          onChange={(e) => setUid(e.target.value)}
        />
        <FieldDescription className="text-center">The reader types the card number and presses Enter.</FieldDescription>
      </Field>
    </form>
  )
}

function ManualQr({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [text, setText] = useState("")
  return (
    <form
      className="flex w-full max-w-sm gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (text.trim()) onSubmit(text.trim())
        setText("")
      }}
    >
      <Input
        placeholder="Or paste QR text / portal link"
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="QR text"
      />
      <Button type="submit" variant="outline">
        Check
      </Button>
    </form>
  )
}

function SimulateLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <div className="mt-4 text-center">
      <Button variant="link" size="sm" onClick={onClick}>
        {children}
      </Button>
    </div>
  )
}
