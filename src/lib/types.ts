export type Role = "owner" | "staff"
export type MemberStatus = "active" | "frozen" | "archived"
export type Gender = "male" | "female" | "other"
export type CredentialType = "card" | "qr" | "fingerprint"
export type CheckInMethod = CredentialType | "assisted" | "gate"
export type PaymentMethod = "cash" | "esewa" | "khalti" | "bank"
/** `${n}d` = n days before expiry, "due" = expiry day, "overdue" = after expiry. */
export type ReminderKind = `${number}d` | "due" | "overdue"
export type ReminderChannel = "in_app" | "sms" | "email"
export type ReminderStatus = "pending" | "sent" | "dismissed"

/** Derived from the member's latest membership + member status. */
export type AccessStatus = "active" | "expiring" | "expired" | "frozen" | "archived" | "none"

export interface Profile {
  id: string
  email: string
  fullName: string
  role: Role
}

export interface Plan {
  id: string
  name: string
  durationDays: number
  priceNpr: number
  active: boolean
}

export interface Member {
  id: string
  memberCode: string
  fullName: string
  phone: string
  email: string | null
  gender: Gender
  dob: string | null
  emergencyContact: string | null
  notes: string | null
  photoUrl: string | null
  status: MemberStatus
  joinedOn: string
  /** Secret token for the member's self-service page and personal QR. */
  portalToken: string
}

export interface Credential {
  id: string
  memberId: string
  type: CredentialType
  value: string
  label: string | null
  active: boolean
  createdAt: string
}

export interface Membership {
  id: string
  memberId: string
  planId: string
  startDate: string
  endDate: string
  amountNpr: number
  createdAt: string
}

export interface Payment {
  id: string
  memberId: string
  membershipId: string | null
  amountNpr: number
  method: PaymentMethod
  note: string | null
  paidAt: string
}

export interface AttendanceRecord {
  id: string
  memberId: string | null
  method: CheckInMethod
  result: "accepted" | "denied"
  denyReason: string | null
  credentialValue: string | null
  checkedInAt: string
}

export interface Reminder {
  id: string
  memberId: string
  membershipId: string
  kind: ReminderKind
  channel: ReminderChannel
  status: ReminderStatus
  scheduledFor: string
  sentAt: string | null
  createdAt: string
}

export interface Addon {
  id: string
  name: string
  priceNpr: number
  active: boolean
}

export interface MemberAddon {
  id: string
  memberId: string
  addonId: string
  startDate: string
  endDate: string | null
}

export interface FollowUpNote {
  id: string
  memberId: string
  note: string
  createdAt: string
}

export interface GymSettings {
  gymName: string
  /** Days before expiry that reminders are generated, e.g. [7, 3, 0]. */
  reminderDays: number[]
  /** Days without a visit before a member lands on the follow-up list. */
  followUpAfterDays: number
  /** A repeat scan within this window is ignored instead of logged twice. */
  duplicateWindowMinutes: number
}

// ---- Derived / composite shapes returned by the API ----

export interface MemberSummary extends Member {
  currentMembership: Membership | null
  planName: string | null
  daysLeft: number | null
  access: AccessStatus
  lastVisit: string | null
  credentialTypes: CredentialType[]
}

export interface MemberDetail {
  member: MemberSummary
  memberships: (Membership & { planName: string })[]
  payments: Payment[]
  credentials: Credential[]
  attendance: AttendanceRecord[]
  addons: (MemberAddon & { addonName: string; priceNpr: number })[]
  notes: FollowUpNote[]
}

export interface AttendanceRow extends AttendanceRecord {
  memberName: string | null
  memberCode: string | null
}

export interface ReminderRow extends Reminder {
  memberName: string
  memberPhone: string
  endDate: string
}

export interface CheckInResult {
  result: "accepted" | "denied" | "duplicate"
  reason: string | null
  member: Pick<Member, "id" | "fullName" | "memberCode" | "photoUrl"> | null
  planName: string | null
  endDate: string | null
  daysLeft: number | null
  at: string
}

export interface DashboardStats {
  activeMembers: number
  todaysCheckIns: number
  renewalsDue: number
  collectedThisMonth: number
  week: { date: string; count: number }[]
}

export interface PortalView {
  member: Pick<Member, "fullName" | "memberCode" | "portalToken">
  /** Active personal QR credential value, shown for scanning at the kiosk. */
  qrValue: string | null
  planName: string | null
  endDate: string | null
  daysLeft: number | null
  access: AccessStatus
  recentVisits: string[]
}

export interface GateSession {
  code: string
  expiresAt: string
}

// ---- Inputs ----

export interface MemberInput {
  fullName: string
  phone: string
  email: string | null
  gender: Gender
  dob: string | null
  emergencyContact: string | null
  notes: string | null
  photoUrl: string | null
  status: MemberStatus
}

export interface NewMemberInput extends MemberInput {
  planId: string
  amountNpr: number
  paymentMethod: PaymentMethod
  startDate: string
}

export interface RenewInput {
  memberId: string
  planId: string
  amountNpr: number
  method: PaymentMethod
}
