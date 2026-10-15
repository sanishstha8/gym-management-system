import { useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { MemberPicker } from "@/features/members/member-picker"

import { CheckInResultCard } from "./checkin-result"
import { useCheckIn } from "./use-check-in"

/** Front-desk check-in for a member who forgot their card or phone. */
export function AssistedCheckInDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false)
  const checkIn = useCheckIn()

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) checkIn.reset()
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assisted check-in</DialogTitle>
          <DialogDescription>Help a member record a visit when they don't have their card or phone.</DialogDescription>
        </DialogHeader>
        {checkIn.data ? (
          <div className="flex flex-col gap-3">
            <CheckInResultCard result={checkIn.data} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => checkIn.reset()}>
                Check in someone else
              </Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <MemberPicker onSelect={(m) => checkIn.mutate({ method: "assisted", value: m.id })} />
        )}
      </DialogContent>
    </Dialog>
  )
}
