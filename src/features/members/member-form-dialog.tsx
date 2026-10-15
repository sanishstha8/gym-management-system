import { useForm } from "@tanstack/react-form"
import { useQuery } from "@tanstack/react-query"
import { Camera, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"

import { MemberAvatar } from "@/components/shared"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { plansQuery, useCreateMember, useUpdateMember } from "@/data/queries"
import { todayISO } from "@/lib/domain"
import { formatNpr, paymentLabels } from "@/lib/format"
import type { Member, MemberInput, PaymentMethod } from "@/lib/types"

const optional = z.string().trim()

const schema = z.object({
  fullName: z.string().trim().min(2, "Enter the member's full name"),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?977)?9\d{9}$/, "Enter a 10-digit Nepali mobile number"),
  email: optional.refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email"),
  gender: z.enum(["male", "female", "other"]),
  dob: optional,
  emergencyContact: optional,
  notes: optional,
  photoUrl: z.string(),
  status: z.enum(["active", "frozen", "archived"]),
  planId: z.string(),
  amountNpr: z.string(),
  paymentMethod: z.enum(["cash", "esewa", "khalti", "bank"]),
  startDate: z.string(),
})

type FormValues = z.infer<typeof schema>

/** Shrinks an uploaded photo to a small square JPEG data URL. */
async function toThumbnail(file: File, size = 160): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = size
  const side = Math.min(bitmap.width, bitmap.height)
  canvas
    .getContext("2d")!
    .drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
  return canvas.toDataURL("image/jpeg", 0.8)
}

export function MemberFormDialog({
  open,
  onOpenChange,
  member,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Edit this member; omit to create a new one. */
  member?: Member
  onCreated?: (id: string) => void
}) {
  const { data: plans = [] } = useQuery(plansQuery)
  const activePlans = plans.filter((p) => p.active)
  const create = useCreateMember()
  const update = useUpdateMember()
  const isEdit = !!member

  const form = useForm({
    defaultValues: {
      fullName: member?.fullName ?? "",
      phone: member?.phone ?? "",
      email: member?.email ?? "",
      gender: member?.gender ?? "male",
      dob: member?.dob ?? "",
      emergencyContact: member?.emergencyContact ?? "",
      notes: member?.notes ?? "",
      photoUrl: member?.photoUrl ?? "",
      status: member?.status ?? "active",
      planId: activePlans[0]?.id ?? "",
      amountNpr: "",
      paymentMethod: "cash",
      startDate: todayISO(),
    } as FormValues,
    validators: {
      onSubmit: schema.superRefine((v, ctx) => {
        if (!isEdit && !v.planId) ctx.addIssue({ code: "custom", path: ["planId"], message: "Choose a plan" })
      }),
    },
    onSubmit: async ({ value }) => {
      const input: MemberInput = {
        fullName: value.fullName.trim(),
        phone: value.phone.trim(),
        email: value.email.trim() || null,
        gender: value.gender,
        dob: value.dob || null,
        emergencyContact: value.emergencyContact.trim() || null,
        notes: value.notes.trim() || null,
        photoUrl: value.photoUrl || null,
        status: value.status,
      }
      let createdId: string | null = null
      try {
        if (member) {
          await update.mutateAsync({ id: member.id, input })
          toast.success("Member updated")
        } else {
          const plan = activePlans.find((p) => p.id === value.planId)
          createdId = await create.mutateAsync({
            ...input,
            planId: value.planId,
            amountNpr: value.amountNpr === "" ? (plan?.priceNpr ?? 0) : Number(value.amountNpr),
            paymentMethod: value.paymentMethod as PaymentMethod,
            startDate: value.startDate || todayISO(),
          })
          toast.success(`${input.fullName} added`)
        }
      } catch {
        return // the mutation's onError already showed a toast
      }
      onOpenChange(false)
      form.reset()
      if (createdId) onCreated?.(createdId)
    },
  })

  const errorsOf = (meta: { isTouched: boolean; errors: unknown[] }, submitted: boolean) =>
    (meta.isTouched || submitted ? meta.errors : []) as { message?: string }[]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit member" : "Add member"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update profile details. Access credentials are managed on the member page."
              : "A personal QR code is issued automatically. Cards and thumbprints can be added after."}
          </DialogDescription>
        </DialogHeader>
        <form
          id="member-form"
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
        >
          <form.Subscribe selector={(s) => s.submissionAttempts > 0}>
            {(submitted) => (
              <FieldGroup className="gap-4">
                <form.Field name="photoUrl">
                  {(field) => (
                    <div className="flex items-center gap-4">
                      <MemberAvatar
                        name={form.getFieldValue("fullName") || "New member"}
                        photoUrl={field.state.value || null}
                        className="size-16 text-base"
                      />
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" asChild>
                          <label className="cursor-pointer">
                            <Camera data-icon="inline-start" />
                            {field.state.value ? "Change photo" : "Add photo"}
                            <input
                              type="file"
                              accept="image/*"
                              capture="user"
                              className="sr-only"
                              onChange={async (e) => {
                                const file = e.target.files?.[0]
                                if (file) field.handleChange(await toThumbnail(file))
                              }}
                            />
                          </label>
                        </Button>
                        {field.state.value && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => field.handleChange("")}>
                            <X data-icon="inline-start" />
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </form.Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <form.Field name="fullName">
                    {(field) => {
                      const errors = errorsOf(field.state.meta, submitted)
                      return (
                        <Field data-invalid={errors.length > 0} className="sm:col-span-2">
                          <FieldLabel htmlFor={field.name}>Full name</FieldLabel>
                          <Input
                            id={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            aria-invalid={errors.length > 0}
                            autoComplete="off"
                          />
                          <FieldError errors={errors} />
                        </Field>
                      )
                    }}
                  </form.Field>
                  <form.Field name="phone">
                    {(field) => {
                      const errors = errorsOf(field.state.meta, submitted)
                      return (
                        <Field data-invalid={errors.length > 0}>
                          <FieldLabel htmlFor={field.name}>Mobile</FieldLabel>
                          <Input
                            id={field.name}
                            inputMode="tel"
                            placeholder="98XXXXXXXX"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            aria-invalid={errors.length > 0}
                          />
                          <FieldError errors={errors} />
                        </Field>
                      )
                    }}
                  </form.Field>
                  <form.Field name="email">
                    {(field) => {
                      const errors = errorsOf(field.state.meta, submitted)
                      return (
                        <Field data-invalid={errors.length > 0}>
                          <FieldLabel htmlFor={field.name}>Email (optional)</FieldLabel>
                          <Input
                            id={field.name}
                            type="email"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            aria-invalid={errors.length > 0}
                          />
                          <FieldError errors={errors} />
                        </Field>
                      )
                    }}
                  </form.Field>
                  <form.Field name="gender">
                    {(field) => (
                      <Field>
                        <FieldLabel>Gender</FieldLabel>
                        <Select value={field.state.value} onValueChange={(v) => field.handleChange(v as FormValues["gender"])}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                  </form.Field>
                  <form.Field name="dob">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>Date of birth</FieldLabel>
                        <Input
                          id={field.name}
                          type="date"
                          max={todayISO()}
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                        />
                      </Field>
                    )}
                  </form.Field>
                  <form.Field name="emergencyContact">
                    {(field) => (
                      <Field className="sm:col-span-2">
                        <FieldLabel htmlFor={field.name}>Emergency contact</FieldLabel>
                        <Input
                          id={field.name}
                          placeholder="Name · phone"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                        />
                      </Field>
                    )}
                  </form.Field>
                  {isEdit && (
                    <form.Field name="status">
                      {(field) => (
                        <Field className="sm:col-span-2">
                          <FieldLabel>Status</FieldLabel>
                          <Select
                            value={field.state.value}
                            onValueChange={(v) => field.handleChange(v as FormValues["status"])}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="frozen">Frozen (pause access, e.g. travel or injury)</SelectItem>
                              <SelectItem value="archived">Archived (left the gym)</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                      )}
                    </form.Field>
                  )}
                  <form.Field name="notes">
                    {(field) => (
                      <Field className="sm:col-span-2">
                        <FieldLabel htmlFor={field.name}>Notes</FieldLabel>
                        <Textarea
                          id={field.name}
                          rows={2}
                          placeholder="Goals, injuries, preferred timings…"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                        />
                      </Field>
                    )}
                  </form.Field>
                </div>

                {!isEdit && (
                  <>
                    <FieldSeparator>Membership</FieldSeparator>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <form.Field name="planId">
                        {(field) => {
                          const errors = errorsOf(field.state.meta, submitted)
                          return (
                            <Field data-invalid={errors.length > 0} className="sm:col-span-2">
                              <FieldLabel>Plan</FieldLabel>
                              <Select
                                value={field.state.value}
                                onValueChange={(v) => {
                                  field.handleChange(v)
                                  form.setFieldValue("amountNpr", "")
                                }}
                              >
                                <SelectTrigger className="w-full" aria-invalid={errors.length > 0}>
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
                              <FieldError errors={errors} />
                            </Field>
                          )
                        }}
                      </form.Field>
                      <form.Field name="amountNpr">
                        {(field) => (
                          <form.Subscribe selector={(s) => s.values.planId}>
                            {(planId) => (
                              <Field>
                                <FieldLabel htmlFor={field.name}>Amount paid (NPR)</FieldLabel>
                                <Input
                                  id={field.name}
                                  type="number"
                                  min={0}
                                  inputMode="numeric"
                                  placeholder={String(activePlans.find((p) => p.id === planId)?.priceNpr ?? "")}
                                  value={field.state.value}
                                  onChange={(e) => field.handleChange(e.target.value)}
                                />
                              </Field>
                            )}
                          </form.Subscribe>
                        )}
                      </form.Field>
                      <form.Field name="paymentMethod">
                        {(field) => (
                          <Field>
                            <FieldLabel>Payment</FieldLabel>
                            <Select
                              value={field.state.value}
                              onValueChange={(v) => field.handleChange(v as FormValues["paymentMethod"])}
                            >
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
                        )}
                      </form.Field>
                      <form.Field name="startDate">
                        {(field) => (
                          <Field className="sm:col-span-2">
                            <FieldLabel htmlFor={field.name}>Start date</FieldLabel>
                            <Input
                              id={field.name}
                              type="date"
                              value={field.state.value}
                              onChange={(e) => field.handleChange(e.target.value)}
                            />
                          </Field>
                        )}
                      </form.Field>
                    </div>
                  </>
                )}
              </FieldGroup>
            )}
          </form.Subscribe>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" form="member-form" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="animate-spin" />}
                {isEdit ? "Save changes" : "Add member"}
              </Button>
            )}
          </form.Subscribe>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
