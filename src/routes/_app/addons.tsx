import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { PackagePlus, Pencil, Plus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { EmptyState, ListSkeleton, PageHeader } from "@/components/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { addonsQuery, profileQuery, useSaveAddon } from "@/data/queries"
import { formatNpr } from "@/lib/format"
import type { Addon } from "@/lib/types"

export const Route = createFileRoute("/_app/addons")({
  component: AddonsPage,
})

function AddonsPage() {
  const { data: addons, isPending } = useQuery(addonsQuery)
  const { data: profile } = useQuery(profileQuery)
  const isOwner = profile?.role === "owner"
  const [editing, setEditing] = useState<Partial<Addon> | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Workspace"
        title="Add-ons"
        description="Extras members can sign up for — lockers, personal training, and more. Assign them from a member's page."
        actions={
          isOwner && (
            <Button onClick={() => setEditing({ name: "", priceNpr: 0, active: true })}>
              <Plus data-icon="inline-start" />
              New add-on
            </Button>
          )
        }
      />
      {isPending ? (
        <ListSkeleton />
      ) : !addons?.length ? (
        <EmptyState icon={PackagePlus} title="No add-ons yet" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {addons.map((a) => (
            <Card key={a.id} className={a.active ? "" : "opacity-60"}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {a.name}
                  {!a.active && <Badge variant="outline">Inactive</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-end justify-between">
                <div>
                  <p className="font-heading text-xl font-semibold">{formatNpr(a.priceNpr)}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.memberCount} member{a.memberCount === 1 ? "" : "s"} subscribed
                  </p>
                </div>
                {isOwner && (
                  <Button size="sm" variant="ghost" onClick={() => setEditing(a)}>
                    <Pencil data-icon="inline-start" />
                    Edit
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {editing && <AddonDialog addon={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function AddonDialog({ addon, onClose }: { addon: Partial<Addon>; onClose: () => void }) {
  const [name, setName] = useState(addon.name ?? "")
  const [price, setPrice] = useState(String(addon.priceNpr ?? 0))
  const [active, setActive] = useState(addon.active ?? true)
  const save = useSaveAddon()

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{addon.id ? "Edit add-on" : "New add-on"}</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="addon-name">Name</FieldLabel>
            <Input id="addon-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field>
            <FieldLabel htmlFor="addon-price">Monthly price (NPR)</FieldLabel>
            <Input id="addon-price" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
          <Field orientation="horizontal">
            <Switch id="addon-active" checked={active} onCheckedChange={setActive} />
            <FieldLabel htmlFor="addon-active">Available to members</FieldLabel>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim() || save.isPending}
            onClick={() =>
              save.mutate(
                { id: addon.id, name: name.trim(), priceNpr: Number(price) || 0, active },
                {
                  onSuccess: () => {
                    toast.success("Add-on saved")
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
