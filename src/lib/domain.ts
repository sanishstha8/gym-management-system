import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns"

import type { AccessStatus, Member, Membership, ReminderKind } from "./types"

/** Memberships within this many days of expiry count as "expiring". */
export const EXPIRING_WINDOW_DAYS = 7

export function toDateISO(d: Date): string {
  return format(d, "yyyy-MM-dd")
}

export function todayISO(): string {
  return toDateISO(new Date())
}

export function addDaysISO(dateISO: string, days: number): string {
  return toDateISO(addDays(parseISO(dateISO), days))
}

/** Calendar days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  return differenceInCalendarDays(parseISO(to), parseISO(from))
}

export function latestMembership<T extends Membership>(memberships: T[]): T | null {
  let latest: T | null = null
  for (const m of memberships) {
    if (!latest || m.endDate > latest.endDate) latest = m
  }
  return latest
}

/**
 * A membership is valid through its end date (inclusive). Renewals are
 * contiguous, so the latest end date is the member's effective expiry.
 */
export function deriveAccess(
  member: Pick<Member, "status">,
  membership: Membership | null,
  today = todayISO(),
): { access: AccessStatus; daysLeft: number | null } {
  const daysLeft = membership ? daysBetween(today, membership.endDate) : null
  if (member.status === "archived") return { access: "archived", daysLeft }
  if (member.status === "frozen") return { access: "frozen", daysLeft }
  if (!membership || daysLeft === null) return { access: "none", daysLeft }
  if (daysLeft < 0) return { access: "expired", daysLeft }
  if (daysLeft <= EXPIRING_WINDOW_DAYS) return { access: "expiring", daysLeft }
  return { access: "active", daysLeft }
}

/** Why a member may not enter, or null when access is allowed. */
export function denyReason(access: AccessStatus, membership: Membership | null): string | null {
  switch (access) {
    case "active":
    case "expiring":
      return null
    case "archived":
      return "Member is archived"
    case "frozen":
      return "Membership is frozen"
    case "expired":
      return `Membership expired on ${membership ? format(parseISO(membership.endDate), "d MMM yyyy") : "—"}`
    case "none":
      return "No active membership"
  }
}

/** Renewals extend from the current end date if still running, otherwise start today. */
export function renewalStartDate(current: Membership | null, today = todayISO()): string {
  if (current && current.endDate >= today) return addDaysISO(current.endDate, 1)
  return today
}

/** Overdue reminders stop being generated this many days after expiry. */
export const OVERDUE_REMINDER_MAX_DAYS = 30

/**
 * Which reminder applies for a membership `daysLeft` from expiry. Picks the
 * tightest threshold that has been reached, so a missed daily run still
 * produces the right reminder the next day.
 */
export function reminderKindFor(daysLeft: number, reminderDays: number[]): ReminderKind | null {
  if (daysLeft < 0) return daysLeft >= -OVERDUE_REMINDER_MAX_DAYS ? "overdue" : null
  const reached = reminderDays.filter((d) => d >= daysLeft).sort((a, b) => a - b)
  if (reached.length === 0) return null
  return reached[0] === 0 ? "due" : `${reached[0]}d`
}

export function reminderMessage(name: string, gymName: string, endDate: string, daysLeft: number): string {
  const first = name.split(" ")[0]
  if (daysLeft < 0)
    return `Namaste ${first}, your ${gymName} membership expired on ${endDate}. Renew at the front desk to keep training.`
  if (daysLeft === 0)
    return `Namaste ${first}, your ${gymName} membership ends today. Renew at the front desk to keep your access.`
  return `Namaste ${first}, your ${gymName} membership ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"} (${endDate}). Renew at the front desk anytime.`
}

export function randomToken(bytes = 12): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("")
}

export function randomDigits(length: number): string {
  const arr = new Uint8Array(length)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => String(b % 10)).join("")
}

/** QR payloads are prefixed so the scanner can ignore unrelated codes. */
export const MEMBER_QR_PREFIX = "SGYM:"

export function memberQrPayload(token: string): string {
  return `${MEMBER_QR_PREFIX}${token}`
}

export function parseMemberQr(text: string): string | null {
  const trimmed = text.trim()
  if (trimmed.startsWith(MEMBER_QR_PREFIX)) return trimmed.slice(MEMBER_QR_PREFIX.length)
  // Also accept a portal URL (…/m/<token>) so members can show their portal page.
  const match = trimmed.match(/\/m\/([a-f0-9]{16,})/i)
  return match ? match[1] : null
}

/** Members with access who haven't visited in `afterDays` days (or ever). */
export function daysSinceVisit(
  member: { lastVisit: string | null; joinedOn: string },
  today = todayISO(),
): number {
  const since = member.lastVisit ? toDateISO(new Date(member.lastVisit)) : member.joinedOn
  return daysBetween(since, today)
}

export function needsFollowUp(
  member: { access: AccessStatus; lastVisit: string | null; joinedOn: string },
  afterDays: number,
  today = todayISO(),
): boolean {
  if (member.access !== "active" && member.access !== "expiring") return false
  return daysSinceVisit(member, today) >= afterDays
}

/** Stored on the member's phone by the portal page so the gate QR knows who is scanning. */
export const PORTAL_TOKEN_KEY = "shrawngym:my-portal-token"
