import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { addDaysISO, todayISO } from "@/lib/domain"
import type {
  AccessStatus,
  AttendanceRecord,
  CheckInResult,
  Credential,
  CredentialType,
  DashboardStats,
  FollowUpNote,
  GateSession,
  Member,
  MemberInput,
  MemberSummary,
  Membership,
  Payment,
  PortalView,
  Profile,
  Reminder,
} from "@/lib/types"

import type { ChangeTopic, GymApi } from "../api"

// Rows come back snake_case; these mappers are the only place that knows it.
type Row = Record<string, any>

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v))

const toMember = (r: Row): Member => ({
  id: r.id,
  memberCode: r.member_code,
  fullName: r.full_name,
  phone: r.phone,
  email: r.email,
  gender: r.gender,
  dob: r.dob,
  emergencyContact: r.emergency_contact,
  notes: r.notes,
  photoUrl: r.photo_url,
  status: r.status,
  joinedOn: r.joined_on,
  portalToken: r.portal_token,
})

const toMembership = (r: Row): Membership => ({
  id: r.id,
  memberId: r.member_id,
  planId: r.plan_id,
  startDate: r.start_date,
  endDate: r.end_date,
  amountNpr: num(r.amount_npr),
  createdAt: r.created_at,
})

const toSummary = (r: Row): MemberSummary => ({
  ...toMember(r),
  currentMembership: r.membership_id
    ? toMembership({ ...r, id: r.membership_id, member_id: r.id, created_at: r.membership_created_at })
    : null,
  planName: r.plan_name,
  daysLeft: r.days_left,
  access: r.access as AccessStatus,
  lastVisit: r.last_visit,
  credentialTypes: r.credential_types ?? [],
})

const toCredential = (r: Row): Credential => ({
  id: r.id,
  memberId: r.member_id,
  type: r.type,
  value: r.value,
  label: r.label,
  active: r.active,
  createdAt: r.created_at,
})

const toPayment = (r: Row): Payment => ({
  id: r.id,
  memberId: r.member_id,
  membershipId: r.membership_id,
  amountNpr: num(r.amount_npr),
  method: r.method,
  note: r.note,
  paidAt: r.paid_at,
})

const toAttendance = (r: Row): AttendanceRecord => ({
  id: r.id,
  memberId: r.member_id,
  method: r.method,
  result: r.result,
  denyReason: r.deny_reason,
  credentialValue: r.credential_value,
  checkedInAt: r.checked_in_at,
})

const toReminder = (r: Row): Reminder => ({
  id: r.id,
  memberId: r.member_id,
  membershipId: r.membership_id,
  kind: r.kind,
  channel: r.channel,
  status: r.status,
  scheduledFor: r.scheduled_for,
  sentAt: r.sent_at,
  createdAt: r.created_at,
})

const toNote = (r: Row): FollowUpNote => ({ id: r.id, memberId: r.member_id, note: r.note, createdAt: r.created_at })

const memberColumns = (m: MemberInput) => ({
  full_name: m.fullName,
  phone: m.phone,
  email: m.email,
  gender: m.gender,
  dob: m.dob,
  emergency_contact: m.emergencyContact,
  notes: m.notes,
  photo_url: m.photoUrl,
  status: m.status,
})

/**
 * Throws the PostgREST error so TanStack Query surfaces it. Data is only null
 * for writes (ignored) and maybeSingle (checked by the caller).
 */
// Untyped client: rows are mapped by the to* helpers above, so results are loosely typed.
function unwrap({ data, error }: { data: unknown; error: { message: string } | null }): any {
  if (error) throw new Error(error.message)
  return data
}

/** Local-midnight bounds for a date range, as ISO timestamps. */
function dayRange(fromISO: string, toISO: string) {
  return {
    from: new Date(`${fromISO}T00:00:00`).toISOString(),
    to: new Date(`${addDaysISO(toISO, 1)}T00:00:00`).toISOString(),
  }
}

const topicByTable: Record<string, ChangeTopic> = {
  attendance: "attendance",
  members: "members",
  credentials: "members",
  memberships: "memberships",
  reminders: "reminders",
}

export function createSupabaseApi(url: string, anonKey: string): GymApi {
  const sb: SupabaseClient = createClient(url, anonKey)

  async function profileFor(userId: string): Promise<Profile | null> {
    const row = unwrap(await sb.from("profiles").select("*").eq("id", userId).maybeSingle())
    return row ? { id: row.id, email: row.email, fullName: row.full_name, role: row.role } : null
  }

  return {
    mode: "supabase",

    async getProfile() {
      const { data } = await sb.auth.getSession()
      return data.session ? profileFor(data.session.user.id) : null
    },

    async signIn(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message)
      const profile = await profileFor(data.user.id)
      if (!profile) throw new Error("This account has no staff profile")
      return profile
    },

    async signOut() {
      await sb.auth.signOut()
    },

    async listMembers() {
      const rows = unwrap(await sb.from("member_summaries").select("*").order("full_name"))
      return rows.map(toSummary)
    },

    async getMember(id) {
      const [summary, memberships, payments, credentials, attendance, addons, notes] = await Promise.all([
        sb.from("member_summaries").select("*").eq("id", id).single(),
        sb.from("memberships").select("*, plans(name)").eq("member_id", id).order("end_date", { ascending: false }),
        sb.from("payments").select("*").eq("member_id", id).order("paid_at", { ascending: false }),
        sb.from("credentials").select("*").eq("member_id", id).order("created_at"),
        sb.from("attendance").select("*").eq("member_id", id).order("checked_in_at", { ascending: false }).limit(50),
        sb.from("member_addons").select("*, addons(name, price_npr)").eq("member_id", id),
        sb.from("follow_up_notes").select("*").eq("member_id", id).order("created_at", { ascending: false }),
      ])
      return {
        member: toSummary(unwrap(summary)),
        memberships: unwrap(memberships).map((r: Row) => ({ ...toMembership(r), planName: r.plans?.name ?? "" })),
        payments: unwrap(payments).map(toPayment),
        credentials: unwrap(credentials).map(toCredential),
        attendance: unwrap(attendance).map(toAttendance),
        addons: unwrap(addons).map((r: Row) => ({
          id: r.id,
          memberId: r.member_id,
          addonId: r.addon_id,
          startDate: r.start_date,
          endDate: r.end_date,
          addonName: r.addons?.name ?? "",
          priceNpr: num(r.addons?.price_npr),
        })),
        notes: unwrap(notes).map(toNote),
      }
    },

    async createMember(input) {
      return unwrap(
        await sb.rpc("create_member", {
          p_member: input,
          p_plan_id: input.planId,
          p_amount: input.amountNpr,
          p_method: input.paymentMethod,
          p_start_date: input.startDate,
        }),
      ) as string
    },

    async updateMember(id, input) {
      unwrap(await sb.from("members").update(memberColumns(input)).eq("id", id))
    },

    async addCredential(memberId, type: CredentialType, value, label) {
      const row = unwrap(
        await sb.from("credentials").insert({ member_id: memberId, type, value: value.trim(), label }).select().single(),
      )
      return toCredential(row)
    },

    async setCredentialActive(id, active) {
      unwrap(await sb.from("credentials").update({ active }).eq("id", id))
    },

    async checkIn(method, value) {
      return unwrap(await sb.rpc("check_in", { p_method: method, p_value: value })) as CheckInResult
    },

    async listAttendance(fromISO, toISO) {
      const { from, to } = dayRange(fromISO, toISO)
      const rows = unwrap(
        await sb
          .from("attendance")
          .select("*, members(full_name, member_code)")
          .gte("checked_in_at", from)
          .lt("checked_in_at", to)
          .order("checked_in_at", { ascending: false }),
      )
      return rows.map((r: Row) => ({
        ...toAttendance(r),
        memberName: r.members?.full_name ?? null,
        memberCode: r.members?.member_code ?? null,
      }))
    },

    async createGateSession() {
      return unwrap(await sb.rpc("create_gate_session")) as GateSession
    },

    async getPortal(token) {
      return unwrap(await sb.rpc("get_portal", { p_token: token })) as PortalView | null
    },

    async gateCheckIn(token, code) {
      return unwrap(await sb.rpc("gate_check_in", { p_token: token, p_code: code })) as CheckInResult
    },

    async renewMembership({ memberId, planId, amountNpr, method }) {
      unwrap(
        await sb.rpc("renew_membership", {
          p_member_id: memberId,
          p_plan_id: planId,
          p_amount: amountNpr,
          p_method: method,
        }),
      )
    },

    async listPayments(fromISO, toISO) {
      const { from, to } = dayRange(fromISO, toISO)
      const rows = unwrap(
        await sb
          .from("payments")
          .select("*, members(full_name)")
          .gte("paid_at", from)
          .lt("paid_at", to)
          .order("paid_at", { ascending: false }),
      )
      return rows.map((r: Row) => ({ ...toPayment(r), memberName: r.members?.full_name ?? "Unknown" }))
    },

    async listReminders() {
      const rows = unwrap(
        await sb
          .from("reminders")
          .select("*, members(full_name, phone), memberships(end_date)")
          .order("created_at", { ascending: false })
          .limit(500),
      )
      return rows.map((r: Row) => ({
        ...toReminder(r),
        memberName: r.members?.full_name ?? "Unknown",
        memberPhone: r.members?.phone ?? "",
        endDate: r.memberships?.end_date ?? "",
      }))
    },

    async generateReminders() {
      return unwrap(await sb.rpc("generate_reminders")) as number
    },

    async sendReminder(id, channel) {
      if (channel === "in_app") {
        unwrap(
          await sb.from("reminders").update({ status: "sent", channel, sent_at: new Date().toISOString() }).eq("id", id),
        )
        return
      }
      const { error } = await sb.functions.invoke("send-reminder", { body: { reminderId: id, channel } })
      if (error) throw new Error(`Could not send ${channel}: ${error.message}`)
    },

    async dismissReminder(id) {
      unwrap(await sb.from("reminders").update({ status: "dismissed" }).eq("id", id))
    },

    async addFollowUpNote(memberId, note) {
      return toNote(unwrap(await sb.from("follow_up_notes").insert({ member_id: memberId, note }).select().single()))
    },

    async listFollowUpNotes() {
      const rows = unwrap(await sb.from("follow_up_notes").select("*").order("created_at", { ascending: false }))
      return rows.map(toNote)
    },

    async listPlans() {
      const rows = unwrap(await sb.from("plans").select("*").order("duration_days"))
      return rows.map((r: Row) => ({
        id: r.id,
        name: r.name,
        durationDays: r.duration_days,
        priceNpr: num(r.price_npr),
        active: r.active,
      }))
    },

    async savePlan({ id, name, durationDays, priceNpr, active }) {
      const row = { name, duration_days: durationDays, price_npr: priceNpr, active }
      unwrap(id ? await sb.from("plans").update(row).eq("id", id) : await sb.from("plans").insert(row))
    },

    async listAddons() {
      const rows = unwrap(
        await sb.from("addons").select("*, member_addons(count)").is("member_addons.end_date", null).order("name"),
      )
      return rows.map((r: Row) => ({
        id: r.id,
        name: r.name,
        priceNpr: num(r.price_npr),
        active: r.active,
        memberCount: r.member_addons?.[0]?.count ?? 0,
      }))
    },

    async saveAddon({ id, name, priceNpr, active }) {
      const row = { name, price_npr: priceNpr, active }
      unwrap(id ? await sb.from("addons").update(row).eq("id", id) : await sb.from("addons").insert(row))
    },

    async assignAddon(memberId, addonId) {
      unwrap(await sb.from("member_addons").insert({ member_id: memberId, addon_id: addonId }))
    },

    async endAddon(id) {
      unwrap(await sb.from("member_addons").update({ end_date: todayISO() }).eq("id", id))
    },

    async getSettings() {
      const r = unwrap(await sb.from("settings").select("*").eq("id", 1).single())
      return {
        gymName: r.gym_name,
        reminderDays: r.reminder_days,
        followUpAfterDays: r.follow_up_after_days,
        duplicateWindowMinutes: r.duplicate_window_minutes,
      }
    },

    async updateSettings(s) {
      unwrap(
        await sb
          .from("settings")
          .update({
            gym_name: s.gymName,
            reminder_days: [...new Set(s.reminderDays)].sort((a, b) => b - a),
            follow_up_after_days: s.followUpAfterDays,
            duplicate_window_minutes: s.duplicateWindowMinutes,
          })
          .eq("id", 1),
      )
    },

    async getDashboard() {
      const d = unwrap(await sb.rpc("dashboard_stats")) as DashboardStats
      return { ...d, collectedThisMonth: num(d.collectedThisMonth) }
    },

    subscribe(listener) {
      const channel = sb.channel("gym-changes")
      for (const table of Object.keys(topicByTable)) {
        channel.on("postgres_changes", { event: "*", schema: "public", table }, () => listener(topicByTable[table]!))
      }
      channel.subscribe()
      return () => {
        void sb.removeChannel(channel)
      }
    },
  }
}
