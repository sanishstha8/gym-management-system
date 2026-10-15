import { format, formatDistanceToNowStrict, parseISO } from "date-fns"

import type { AccessStatus, CheckInMethod, PaymentMethod } from "./types"

const nprFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 })

export function formatNpr(amount: number): string {
  return `NPR ${nprFormatter.format(amount)}`
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return format(parseISO(iso), "d MMM yyyy")
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  return format(parseISO(iso), "d MMM yyyy, h:mm a")
}

export function formatTime(iso: string): string {
  return format(parseISO(iso), "h:mm a")
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "never"
  return `${formatDistanceToNowStrict(parseISO(iso))} ago`
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("")
}

export function daysLeftLabel(daysLeft: number | null): string {
  if (daysLeft === null) return "No plan"
  if (daysLeft < 0) return `Expired ${-daysLeft}d ago`
  if (daysLeft === 0) return "Ends today"
  return `${daysLeft}d left`
}

export const accessLabels: Record<AccessStatus, string> = {
  active: "Active",
  expiring: "Expiring",
  expired: "Expired",
  frozen: "Frozen",
  archived: "Archived",
  none: "No plan",
}

export const methodLabels: Record<CheckInMethod, string> = {
  card: "Card",
  qr: "QR code",
  fingerprint: "Thumb",
  assisted: "Assisted",
  gate: "Gate QR",
}

export const paymentLabels: Record<PaymentMethod, string> = {
  cash: "Cash",
  esewa: "eSewa",
  khalti: "Khalti",
  bank: "Bank transfer",
}
