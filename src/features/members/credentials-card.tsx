import { CreditCard, Download, Fingerprint, Plus, QrCode, RefreshCw } from "lucide-react"
import { QRCodeCanvas } from "qrcode.react"
import { useRef, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAddCredential, useSetCredentialActive } from "@/data/queries"
import { memberQrPayload, randomDigits, randomToken } from "@/lib/domain"
import { formatDate } from "@/lib/format"
import type { Credential, CredentialType, Member } from "@/lib/types"
import { cn } from "@/lib/utils"

import { FingerprintPad } from "./fingerprint-pad"

const icons: Record<CredentialType, typeof QrCode> = { card: CreditCard, qr: QrCode, fingerprint: Fingerprint }

export function CredentialsCard({ member, credentials }: { member: Member; credentials: Credential[] }) {
  const [dialog, setDialog] = useState<"card" | "fingerprint" | null>(null)
  const add = useAddCredential()
  const setActive = useSetCredentialActive()
  const qr = credentials.find((c) => c.type === "qr" && c.active)
  const qrWrap = useRef<HTMLDivElement>(null)
  const others = credentials
    .filter((c) => c.type !== "qr" || !c.active)
    .sort((a, b) => Number(b.active) - Number(a.active) || b.createdAt.localeCompare(a.createdAt))

  function downloadQr() {
    const canvas = qrWrap.current?.querySelector("canvas")
    if (!canvas) return
    const link = document.createElement("a")
    link.download = `${member.memberCode}-qr.png`
    link.href = canvas.toDataURL("image/png")
    link.click()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gym access</CardTitle>
        <CardDescription>Card, QR code and thumbprint used at the entrance.</CardDescription>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus data-icon="inline-start" />
                Add
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setDialog("card")}>
                <CreditCard />
                Register RFID card
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDialog("fingerprint")}>
                <Fingerprint />
                Enroll thumbprint
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  add.mutate(
                    { memberId: member.id, type: "qr", value: randomToken(), label: "Personal QR" },
                    { onSuccess: () => toast.success("New QR issued — the old one no longer works") },
                  )
                }
              >
                <RefreshCw />
                Reissue QR code
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {qr ? (
          <div className="flex items-center gap-4 rounded-lg border p-3">
            <div ref={qrWrap} className="rounded-md bg-white p-2">
              <QRCodeCanvas value={memberQrPayload(qr.value)} size={104} marginSize={0} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div>
                <p className="text-sm font-medium">Personal QR</p>
                <p className="text-xs text-muted-foreground">Scan at the kiosk. Issued {formatDate(qr.createdAt)}</p>
              </div>
              <Button size="sm" variant="outline" className="self-start" onClick={downloadQr}>
                <Download data-icon="inline-start" />
                Download
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No active QR code. Use Add → Reissue QR code.</p>
        )}

        {others.length > 0 && (
          <ul className="flex flex-col divide-y rounded-lg border">
            {others.map((c) => {
              const Icon = icons[c.type]
              return (
                <li key={c.id} className={cn("flex items-center gap-3 px-3 py-2.5", !c.active && "opacity-60")}>
                  <Icon className="size-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.label ?? c.type}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {c.type === "qr" ? "Previous QR" : c.value}
                    </p>
                  </div>
                  {!c.active && <Badge variant="outline">Revoked</Badge>}
                  {c.type !== "qr" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setActive.mutate({ id: c.id, active: !c.active })}
                    >
                      {c.active ? "Revoke" : "Restore"}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>

      <RegisterCardDialog
        open={dialog === "card"}
        onOpenChange={(o) => setDialog(o ? "card" : null)}
        onSubmit={(value) =>
          add.mutateAsync({ memberId: member.id, type: "card", value: value.toUpperCase(), label: "RFID card" })
        }
      />
      <EnrollFingerprintDialog
        open={dialog === "fingerprint"}
        onOpenChange={(o) => setDialog(o ? "fingerprint" : null)}
        onSubmit={(label) =>
          // A real reader returns its own template / user id; the demo makes one up.
          add.mutateAsync({ memberId: member.id, type: "fingerprint", value: `FP-${randomDigits(6)}`, label })
        }
      />
    </Card>
  )
}

function RegisterCardDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (uid: string) => Promise<unknown>
}) {
  const [uid, setUid] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!uid.trim()) return
    setBusy(true)
    try {
      await onSubmit(uid.trim())
      toast.success("Card registered")
      setUid("")
      onOpenChange(false)
    } catch {
      // toast shown by the mutation
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Register RFID card</DialogTitle>
          <DialogDescription>Tap the card on the USB reader, or type the number printed on it.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <Field>
            <FieldLabel htmlFor="card-uid">Card UID</FieldLabel>
            <Input
              id="card-uid"
              autoFocus
              autoComplete="off"
              className="font-mono uppercase"
              placeholder="e.g. 04A1B2C3"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
            />
            <FieldDescription>Most desk readers type the UID and press Enter automatically.</FieldDescription>
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!uid.trim() || busy}>
            Register card
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const SCANS_NEEDED = 3

function EnrollFingerprintDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (label: string) => Promise<unknown>
}) {
  const [finger, setFinger] = useState("Right thumb")
  const [scans, setScans] = useState(0)

  async function onScan() {
    const next = scans + 1
    setScans(next)
    if (next < SCANS_NEEDED) return
    try {
      await onSubmit(finger)
      toast.success(`${finger} enrolled`)
      onOpenChange(false)
    } catch {
      // toast shown by the mutation
    } finally {
      setScans(0)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        setScans(0)
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Enroll thumbprint</DialogTitle>
          <DialogDescription>
            Simulated sensor — the member places the same finger {SCANS_NEEDED} times.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel>Finger</FieldLabel>
          <Select value={finger} onValueChange={setFinger} disabled={scans > 0}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["Right thumb", "Left thumb", "Right index", "Left index"].map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="flex flex-col items-center gap-3 py-2">
          <FingerprintPad onScan={onScan} label={scans === 0 ? "Press and hold" : "Again"} />
          <Progress value={(scans / SCANS_NEEDED) * 100} className="w-40" />
          <p className="text-xs text-muted-foreground">
            Scan {Math.min(scans + 1, SCANS_NEEDED)} of {SCANS_NEEDED}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
