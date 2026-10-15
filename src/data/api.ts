import type {
  Addon,
  AttendanceRow,
  CheckInMethod,
  CheckInResult,
  Credential,
  CredentialType,
  DashboardStats,
  FollowUpNote,
  GateSession,
  GymSettings,
  MemberDetail,
  MemberInput,
  MemberSummary,
  NewMemberInput,
  Payment,
  Plan,
  PortalView,
  Profile,
  ReminderChannel,
  ReminderRow,
  RenewInput,
} from "@/lib/types"

/** Tables that can change underneath the UI (other staff, devices, cron). */
export type ChangeTopic = "members" | "attendance" | "memberships" | "reminders" | "settings"

/**
 * Everything the UI needs from a backend. Two implementations exist:
 * `supabase/adapter.ts` (real backend) and `demo/adapter.ts` (browser-local).
 */
export interface GymApi {
  readonly mode: "supabase" | "demo"

  // Auth
  getProfile(): Promise<Profile | null>
  signIn(email: string, password: string): Promise<Profile>
  signOut(): Promise<void>

  // Members
  listMembers(): Promise<MemberSummary[]>
  getMember(id: string): Promise<MemberDetail>
  createMember(input: NewMemberInput): Promise<string>
  updateMember(id: string, input: MemberInput): Promise<void>

  // Access credentials
  addCredential(memberId: string, type: CredentialType, value: string, label: string | null): Promise<Credential>
  setCredentialActive(id: string, active: boolean): Promise<void>

  // Check-in. `value` is the card UID, QR token, fingerprint id, or member id (assisted).
  checkIn(method: Exclude<CheckInMethod, "gate">, value: string): Promise<CheckInResult>
  listAttendance(fromISO: string, toISO: string): Promise<AttendanceRow[]>

  // Gate QR (members scan a rotating code with their own phone)
  createGateSession(): Promise<GateSession>
  getPortal(token: string): Promise<PortalView | null>
  gateCheckIn(token: string, code: string): Promise<CheckInResult>

  // Renewals & reminders
  renewMembership(input: RenewInput): Promise<void>
  listPayments(fromISO: string, toISO: string): Promise<(Payment & { memberName: string })[]>
  listReminders(): Promise<ReminderRow[]>
  generateReminders(): Promise<number>
  sendReminder(id: string, channel: ReminderChannel): Promise<void>
  dismissReminder(id: string): Promise<void>

  // Follow-ups
  addFollowUpNote(memberId: string, note: string): Promise<FollowUpNote>
  listFollowUpNotes(): Promise<FollowUpNote[]>

  // Catalog
  listPlans(): Promise<Plan[]>
  savePlan(plan: Omit<Plan, "id"> & { id?: string }): Promise<void>
  listAddons(): Promise<(Addon & { memberCount: number })[]>
  saveAddon(addon: Omit<Addon, "id"> & { id?: string }): Promise<void>
  assignAddon(memberId: string, addonId: string): Promise<void>
  endAddon(memberAddonId: string): Promise<void>

  // Settings & dashboard
  getSettings(): Promise<GymSettings>
  updateSettings(settings: GymSettings): Promise<void>
  getDashboard(): Promise<DashboardStats>

  /** Notifies when data changes outside this tab. Returns an unsubscribe fn. */
  subscribe(listener: (topic: ChangeTopic) => void): () => void
}
