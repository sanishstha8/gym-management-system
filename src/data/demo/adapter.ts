import {
  addDaysISO,
  daysBetween,
  denyReason,
  deriveAccess,
  latestMembership,
  randomDigits,
  randomToken,
  reminderKindFor,
  renewalStartDate,
  toDateISO,
  todayISO,
} from "@/lib/domain"
import type {
  CheckInMethod,
  CheckInResult,
  Member,
  MemberSummary,
  Profile,
} from "@/lib/types"

import type { ChangeTopic, GymApi } from "../api"
import { createSeed, type DemoDb } from "./seed"

const DB_KEY = "shrawngym:demo-db"
const SESSION_KEY = "shrawngym:demo-session"
const GATE_CODE_TTL_MS = 60_000

const demoUsers: Record<string, Profile> = {
  "owner@shrawngym.demo": { id: "user-owner", email: "owner@shrawngym.demo", fullName: "Demo Owner", role: "owner" },
  "staff@shrawngym.demo": { id: "user-staff", email: "staff@shrawngym.demo", fullName: "Front Desk", role: "staff" },
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Storage unavailable (private mode); the demo keeps working in memory.
  }
}

let db: DemoDb = load()

function load(): DemoDb {
  const raw = safeGet(DB_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DemoDb
      if (parsed.version === 1) return parsed
    } catch {
      // fall through to a fresh seed
    }
  }
  const seed = createSeed()
  safeSet(DB_KEY, JSON.stringify(seed))
  return seed
}

const listeners = new Set<(topic: ChangeTopic) => void>()
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("shrawngym-demo") : null
channel?.addEventListener("message", (e: MessageEvent<ChangeTopic>) => {
  db = load()
  listeners.forEach((l) => l(e.data))
})

function commit(...topics: ChangeTopic[]) {
  safeSet(DB_KEY, JSON.stringify(db))
  for (const t of topics) channel?.postMessage(t)
}

const id = (prefix: string) => `${prefix}-${randomToken(6)}`
const nowISO = () => new Date().toISOString()
/** Simulates network latency so loading states are visible and realistic. */
const tick = <T>(value: T): Promise<T> => new Promise((r) => setTimeout(() => r(value), 120))

function requireMember(memberId: string): Member {
  const m = db.members.find((x) => x.id === memberId)
  if (!m) throw new Error("Member not found")
  return m
}

function summarize(member: Member, today = todayISO()): MemberSummary {
  const current = latestMembership(db.memberships.filter((m) => m.memberId === member.id))
  const { access, daysLeft } = deriveAccess(member, current, today)
  let lastVisit: string | null = null
  for (const a of db.attendance) {
    if (a.memberId === member.id && a.result === "accepted" && (!lastVisit || a.checkedInAt > lastVisit))
      lastVisit = a.checkedInAt
  }
  const credentialTypes = [
    ...new Set(db.credentials.filter((c) => c.memberId === member.id && c.active).map((c) => c.type)),
  ]
  return {
    ...member,
    currentMembership: current,
    planName: current ? (db.plans.find((p) => p.id === current.planId)?.name ?? null) : null,
    daysLeft,
    access,
    lastVisit,
    credentialTypes,
  }
}

function recordCheckIn(
  member: Member | null,
  method: CheckInMethod,
  credentialValue: string | null,
  forcedReason?: string,
): CheckInResult {
  const at = nowISO()
  if (!member) {
    const reason = forcedReason ?? "Unknown credential"
    db.attendance.push({
      id: id("att"),
      memberId: null,
      method,
      result: "denied",
      denyReason: reason,
      credentialValue,
      checkedInAt: at,
    })
    commit("attendance")
    return { result: "denied", reason, member: null, planName: null, endDate: null, daysLeft: null, at }
  }

  const summary = summarize(member)
  const reason = forcedReason ?? denyReason(summary.access, summary.currentMembership)
  const base = {
    member: { id: member.id, fullName: member.fullName, memberCode: member.memberCode, photoUrl: member.photoUrl },
    planName: summary.planName,
    endDate: summary.currentMembership?.endDate ?? null,
    daysLeft: summary.daysLeft,
    at,
  }

  if (!reason) {
    const windowStart = Date.now() - db.settings.duplicateWindowMinutes * 60_000
    const recent = db.attendance.find(
      (a) =>
        a.memberId === member.id && a.result === "accepted" && new Date(a.checkedInAt).getTime() >= windowStart,
    )
    if (recent) {
      return { ...base, result: "duplicate", reason: "Already checked in recently" }
    }
  }

  db.attendance.push({
    id: id("att"),
    memberId: member.id,
    method,
    result: reason ? "denied" : "accepted",
    denyReason: reason,
    credentialValue,
    checkedInAt: at,
  })
  commit("attendance")
  return { ...base, result: reason ? "denied" : "accepted", reason }
}

export const demoApi: GymApi = {
  mode: "demo",

  async getProfile() {
    const email = safeGet(SESSION_KEY)
    return email ? (demoUsers[email] ?? null) : null
  },

  async signIn(email) {
    const profile = demoUsers[email.trim().toLowerCase()]
    if (!profile) throw new Error("Use owner@shrawngym.demo or staff@shrawngym.demo in demo mode")
    safeSet(SESSION_KEY, profile.email)
    return tick(profile)
  },

  async signOut() {
    safeSet(SESSION_KEY, null)
  },

  async listMembers() {
    const today = todayISO()
    return tick(db.members.map((m) => summarize(m, today)))
  },

  async getMember(memberId) {
    const member = requireMember(memberId)
    const planName = (planId: string) => db.plans.find((p) => p.id === planId)?.name ?? "Unknown plan"
    return tick({
      member: summarize(member),
      memberships: db.memberships
        .filter((m) => m.memberId === memberId)
        .map((m) => ({ ...m, planName: planName(m.planId) }))
        .sort((a, b) => b.endDate.localeCompare(a.endDate)),
      payments: db.payments.filter((p) => p.memberId === memberId).sort((a, b) => b.paidAt.localeCompare(a.paidAt)),
      credentials: db.credentials.filter((c) => c.memberId === memberId),
      attendance: db.attendance
        .filter((a) => a.memberId === memberId)
        .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt))
        .slice(0, 50),
      addons: db.memberAddons
        .filter((ma) => ma.memberId === memberId)
        .map((ma) => {
          const addon = db.addons.find((a) => a.id === ma.addonId)
          return { ...ma, addonName: addon?.name ?? "Add-on", priceNpr: addon?.priceNpr ?? 0 }
        }),
      notes: db.notes.filter((n) => n.memberId === memberId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    })
  },

  async createMember(input) {
    const plan = db.plans.find((p) => p.id === input.planId)
    if (!plan) throw new Error("Choose a plan")
    const next = db.members.reduce((max, m) => Math.max(max, Number(m.memberCode.split("-")[1]) || 0), 1000) + 1
    const memberId = id("mem")
    const { amountNpr, paymentMethod, startDate } = input
    db.members.push({
      fullName: input.fullName,
      phone: input.phone,
      email: input.email,
      gender: input.gender,
      dob: input.dob,
      emergencyContact: input.emergencyContact,
      notes: input.notes,
      photoUrl: input.photoUrl,
      status: input.status,
      id: memberId,
      memberCode: `SG-${next}`,
      joinedOn: todayISO(),
      portalToken: randomToken(),
    })
    const membershipId = id("ms")
    db.memberships.push({
      id: membershipId,
      memberId,
      planId: plan.id,
      startDate,
      endDate: addDaysISO(startDate, plan.durationDays - 1),
      amountNpr,
      createdAt: nowISO(),
    })
    db.payments.push({
      id: id("pay"),
      memberId,
      membershipId,
      amountNpr,
      method: paymentMethod,
      note: "New membership",
      paidAt: nowISO(),
    })
    db.credentials.push({
      id: id("cred"),
      memberId,
      type: "qr",
      value: randomToken(),
      label: "Personal QR",
      active: true,
      createdAt: nowISO(),
    })
    commit("members", "memberships")
    return tick(memberId)
  },

  async updateMember(memberId, input) {
    const member = requireMember(memberId)
    Object.assign(member, input)
    commit("members")
    await tick(null)
  },

  async addCredential(memberId, type, value, label) {
    requireMember(memberId)
    const clean = value.trim()
    if (!clean) throw new Error("Credential value is required")
    if (db.credentials.some((c) => c.type === type && c.value.toLowerCase() === clean.toLowerCase() && c.active))
      throw new Error("This credential is already assigned to a member")
    if (type === "qr") {
      // A member has one personal QR at a time; issuing a new one revokes the old.
      db.credentials.forEach((c) => {
        if (c.memberId === memberId && c.type === "qr") c.active = false
      })
    }
    const credential = { id: id("cred"), memberId, type, value: clean, label, active: true, createdAt: nowISO() }
    db.credentials.push(credential)
    commit("members")
    return tick(credential)
  },

  async setCredentialActive(credentialId, active) {
    const c = db.credentials.find((x) => x.id === credentialId)
    if (!c) throw new Error("Credential not found")
    c.active = active
    commit("members")
    await tick(null)
  },

  async checkIn(method, value) {
    db = load()
    const clean = value.trim()
    if (method === "assisted") {
      const member = db.members.find((m) => m.id === clean) ?? null
      return tick(recordCheckIn(member, method, null))
    }
    const credential = db.credentials.find(
      (c) => c.type === method && c.value.toLowerCase() === clean.toLowerCase(),
    )
    if (!credential) return tick(recordCheckIn(null, method, clean))
    const member = db.members.find((m) => m.id === credential.memberId) ?? null
    return tick(recordCheckIn(member, method, clean, credential.active ? undefined : "Credential has been revoked"))
  },

  async listAttendance(fromISO, toISO) {
    const from = new Date(`${fromISO}T00:00:00`).toISOString()
    const to = new Date(`${addDaysISO(toISO, 1)}T00:00:00`).toISOString()
    const rows = db.attendance
      .filter((a) => a.checkedInAt >= from && a.checkedInAt < to)
      .map((a) => {
        const m = a.memberId ? db.members.find((x) => x.id === a.memberId) : undefined
        return { ...a, memberName: m?.fullName ?? null, memberCode: m?.memberCode ?? null }
      })
      .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt))
    return tick(rows)
  },

  async createGateSession() {
    const now = Date.now()
    db.gateSessions = db.gateSessions.filter((s) => new Date(s.expiresAt).getTime() > now)
    const session = { code: randomDigits(6), expiresAt: new Date(now + GATE_CODE_TTL_MS).toISOString() }
    db.gateSessions.push(session)
    commit()
    return tick(session)
  },

  async getPortal(token) {
    db = load()
    const member = db.members.find((m) => m.portalToken === token)
    if (!member) return tick(null)
    const s = summarize(member)
    return tick({
      member: { fullName: member.fullName, memberCode: member.memberCode, portalToken: member.portalToken },
      qrValue: db.credentials.find((c) => c.memberId === member.id && c.type === "qr" && c.active)?.value ?? null,
      planName: s.planName,
      endDate: s.currentMembership?.endDate ?? null,
      daysLeft: s.daysLeft,
      access: s.access,
      recentVisits: db.attendance
        .filter((a) => a.memberId === member.id && a.result === "accepted")
        .map((a) => a.checkedInAt)
        .sort((a, b) => b.localeCompare(a))
        .slice(0, 5),
    })
  },

  async gateCheckIn(token, code) {
    db = load()
    const member = db.members.find((m) => m.portalToken === token) ?? null
    if (!member) return tick(recordCheckIn(null, "gate", null, "Unknown member link"))
    const valid = db.gateSessions.some((s) => s.code === code && new Date(s.expiresAt).getTime() > Date.now())
    return tick(recordCheckIn(member, "gate", null, valid ? undefined : "Gate code expired — scan the screen again"))
  },

  async renewMembership({ memberId, planId, amountNpr, method }) {
    requireMember(memberId)
    const plan = db.plans.find((p) => p.id === planId)
    if (!plan) throw new Error("Choose a plan")
    const current = latestMembership(db.memberships.filter((m) => m.memberId === memberId))
    const startDate = renewalStartDate(current)
    const membershipId = id("ms")
    db.memberships.push({
      id: membershipId,
      memberId,
      planId,
      startDate,
      endDate: addDaysISO(startDate, plan.durationDays - 1),
      amountNpr,
      createdAt: nowISO(),
    })
    db.payments.push({ id: id("pay"), memberId, membershipId, amountNpr, method, note: "Renewal", paidAt: nowISO() })
    // Outstanding reminders for the old membership are no longer relevant.
    db.reminders.forEach((r) => {
      if (r.memberId === memberId && r.status === "pending") r.status = "dismissed"
    })
    commit("memberships", "reminders")
    await tick(null)
  },

  async listPayments(fromISO, toISO) {
    const from = new Date(`${fromISO}T00:00:00`).toISOString()
    const to = new Date(`${addDaysISO(toISO, 1)}T00:00:00`).toISOString()
    return tick(
      db.payments
        .filter((p) => p.paidAt >= from && p.paidAt < to)
        .map((p) => ({ ...p, memberName: db.members.find((m) => m.id === p.memberId)?.fullName ?? "Unknown" }))
        .sort((a, b) => b.paidAt.localeCompare(a.paidAt)),
    )
  },

  async listReminders() {
    return tick(
      db.reminders
        .map((r) => {
          const m = db.members.find((x) => x.id === r.memberId)
          const ms = db.memberships.find((x) => x.id === r.membershipId)
          return { ...r, memberName: m?.fullName ?? "Unknown", memberPhone: m?.phone ?? "", endDate: ms?.endDate ?? "" }
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    )
  },

  async generateReminders() {
    const today = todayISO()
    let created = 0
    for (const member of db.members) {
      if (member.status !== "active") continue
      const current = latestMembership(db.memberships.filter((m) => m.memberId === member.id))
      if (!current) continue
      const kind = reminderKindFor(daysBetween(today, current.endDate), db.settings.reminderDays)
      if (!kind) continue
      if (db.reminders.some((r) => r.membershipId === current.id && r.kind === kind)) continue
      db.reminders.push({
        id: id("rem"),
        memberId: member.id,
        membershipId: current.id,
        kind,
        channel: "in_app",
        status: "pending",
        scheduledFor: today,
        sentAt: null,
        createdAt: nowISO(),
      })
      created++
    }
    if (created) commit("reminders")
    return tick(created)
  },

  async sendReminder(reminderId, channelName) {
    const r = db.reminders.find((x) => x.id === reminderId)
    if (!r) throw new Error("Reminder not found")
    // SMS / email delivery is stubbed: the reminder is logged as sent.
    r.channel = channelName
    r.status = "sent"
    r.sentAt = nowISO()
    commit("reminders")
    await tick(null)
  },

  async dismissReminder(reminderId) {
    const r = db.reminders.find((x) => x.id === reminderId)
    if (r) r.status = "dismissed"
    commit("reminders")
    await tick(null)
  },

  async addFollowUpNote(memberId, note) {
    const n = { id: id("note"), memberId, note: note.trim(), createdAt: nowISO() }
    db.notes.push(n)
    commit("members")
    return tick(n)
  },

  async listFollowUpNotes() {
    return tick([...db.notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  },

  async listPlans() {
    return tick([...db.plans])
  },

  async savePlan(plan) {
    if (plan.id) Object.assign(db.plans.find((p) => p.id === plan.id) ?? {}, plan)
    else db.plans.push({ ...plan, id: id("plan") })
    commit("settings")
    await tick(null)
  },

  async listAddons() {
    return tick(
      db.addons.map((a) => ({
        ...a,
        memberCount: db.memberAddons.filter((ma) => ma.addonId === a.id && !ma.endDate).length,
      })),
    )
  },

  async saveAddon(addon) {
    if (addon.id) Object.assign(db.addons.find((a) => a.id === addon.id) ?? {}, addon)
    else db.addons.push({ ...addon, id: id("addon") })
    commit("settings")
    await tick(null)
  },

  async assignAddon(memberId, addonId) {
    if (db.memberAddons.some((ma) => ma.memberId === memberId && ma.addonId === addonId && !ma.endDate))
      throw new Error("Member already has this add-on")
    db.memberAddons.push({ id: id("ma"), memberId, addonId, startDate: todayISO(), endDate: null })
    commit("members")
    await tick(null)
  },

  async endAddon(memberAddonId) {
    const ma = db.memberAddons.find((x) => x.id === memberAddonId)
    if (ma) ma.endDate = todayISO()
    commit("members")
    await tick(null)
  },

  async getSettings() {
    return tick({ ...db.settings })
  },

  async updateSettings(settings) {
    db.settings = { ...settings, reminderDays: [...new Set(settings.reminderDays)].sort((a, b) => b - a) }
    commit("settings")
    await tick(null)
  },

  async getDashboard() {
    const today = todayISO()
    const summaries = db.members.map((m) => summarize(m, today))
    const weekStart = addDaysISO(today, -6)
    const week = Array.from({ length: 7 }, (_, i) => ({ date: addDaysISO(weekStart, i), count: 0 }))
    let todaysCheckIns = 0
    for (const a of db.attendance) {
      if (a.result !== "accepted") continue
      const day = toDateISO(new Date(a.checkedInAt))
      if (day === today) todaysCheckIns++
      const slot = week.find((w) => w.date === day)
      if (slot) slot.count++
    }
    const monthStart = `${today.slice(0, 8)}01`
    return tick({
      activeMembers: summaries.filter((s) => s.access === "active" || s.access === "expiring").length,
      todaysCheckIns,
      renewalsDue: summaries.filter((s) => s.access === "expiring").length,
      collectedThisMonth: db.payments
        .filter((p) => toDateISO(new Date(p.paidAt)) >= monthStart)
        .reduce((sum, p) => sum + p.amountNpr, 0),
      week,
    })
  },

  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

/** Wipes local demo data and re-seeds. */
export function resetDemoData() {
  db = createSeed()
  commit("members", "attendance", "memberships", "reminders", "settings")
  listeners.forEach((l) => l("members"))
}
