import { QueryClient, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import type {
  Addon,
  CredentialType,
  GymSettings,
  MemberInput,
  NewMemberInput,
  Plan,
  ReminderChannel,
  RenewInput,
} from "@/lib/types"

import { api, type ChangeTopic } from "."

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
    mutations: {
      onError: (error) => toast.error(error instanceof Error ? error.message : "Something went wrong"),
    },
  },
})

export const keys = {
  profile: ["profile"] as const,
  members: ["members"] as const,
  member: (id: string) => ["member", id] as const,
  attendance: (from: string, to: string) => ["attendance", from, to] as const,
  payments: (from: string, to: string) => ["payments", from, to] as const,
  reminders: ["reminders"] as const,
  notes: ["notes"] as const,
  dashboard: ["dashboard"] as const,
  plans: ["plans"] as const,
  addons: ["addons"] as const,
  settings: ["settings"] as const,
  portal: (token: string) => ["portal", token] as const,
}

export const profileQuery = queryOptions({ queryKey: keys.profile, queryFn: () => api.getProfile(), staleTime: Infinity })
export const membersQuery = queryOptions({ queryKey: keys.members, queryFn: () => api.listMembers() })
export const memberQuery = (id: string) => queryOptions({ queryKey: keys.member(id), queryFn: () => api.getMember(id) })
export const attendanceQuery = (from: string, to: string) =>
  queryOptions({ queryKey: keys.attendance(from, to), queryFn: () => api.listAttendance(from, to) })
export const paymentsQuery = (from: string, to: string) =>
  queryOptions({ queryKey: keys.payments(from, to), queryFn: () => api.listPayments(from, to) })
export const remindersQuery = queryOptions({ queryKey: keys.reminders, queryFn: () => api.listReminders() })
export const notesQuery = queryOptions({ queryKey: keys.notes, queryFn: () => api.listFollowUpNotes() })
export const dashboardQuery = queryOptions({ queryKey: keys.dashboard, queryFn: () => api.getDashboard() })
export const plansQuery = queryOptions({ queryKey: keys.plans, queryFn: () => api.listPlans() })
export const addonsQuery = queryOptions({ queryKey: keys.addons, queryFn: () => api.listAddons() })
export const settingsQuery = queryOptions({ queryKey: keys.settings, queryFn: () => api.getSettings() })
export const portalQuery = (token: string) =>
  queryOptions({ queryKey: keys.portal(token), queryFn: () => api.getPortal(token) })

/** Which cached queries depend on each kind of change. */
const affected: Record<ChangeTopic, string[]> = {
  members: ["members", "member", "dashboard", "notes", "addons"],
  attendance: ["attendance", "dashboard", "members", "member", "portal"],
  memberships: ["members", "member", "dashboard", "payments", "reminders", "portal"],
  reminders: ["reminders"],
  settings: ["settings", "plans", "addons", "dashboard"],
}

export function invalidateTopics(client: QueryClient, ...topics: ChangeTopic[]) {
  const roots = new Set(topics.flatMap((t) => affected[t]))
  return client.invalidateQueries({ predicate: (q) => roots.has(String(q.queryKey[0])) })
}

/** Wraps a mutation so it refreshes the right queries when it succeeds. */
function useApiMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>, topics: ChangeTopic[]) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => invalidateTopics(client, ...topics),
  })
}

export const useCreateMember = () =>
  useApiMutation((input: NewMemberInput) => api.createMember(input), ["members", "memberships"])
export const useUpdateMember = () =>
  useApiMutation(({ id, input }: { id: string; input: MemberInput }) => api.updateMember(id, input), ["members"])
export const useAddCredential = () =>
  useApiMutation(
    (v: { memberId: string; type: CredentialType; value: string; label: string | null }) =>
      api.addCredential(v.memberId, v.type, v.value, v.label),
    ["members"],
  )
export const useSetCredentialActive = () =>
  useApiMutation((v: { id: string; active: boolean }) => api.setCredentialActive(v.id, v.active), ["members"])
export const useRenew = () => useApiMutation((input: RenewInput) => api.renewMembership(input), ["memberships"])
export const useGenerateReminders = () => useApiMutation(() => api.generateReminders(), ["reminders"])
export const useSendReminder = () =>
  useApiMutation((v: { id: string; channel: ReminderChannel }) => api.sendReminder(v.id, v.channel), ["reminders"])
export const useDismissReminder = () => useApiMutation((id: string) => api.dismissReminder(id), ["reminders"])
export const useAddNote = () =>
  useApiMutation((v: { memberId: string; note: string }) => api.addFollowUpNote(v.memberId, v.note), ["members"])
export const useSavePlan = () =>
  useApiMutation((plan: Omit<Plan, "id"> & { id?: string }) => api.savePlan(plan), ["settings"])
export const useSaveAddon = () =>
  useApiMutation((addon: Omit<Addon, "id"> & { id?: string }) => api.saveAddon(addon), ["settings"])
export const useAssignAddon = () =>
  useApiMutation((v: { memberId: string; addonId: string }) => api.assignAddon(v.memberId, v.addonId), ["members"])
export const useEndAddon = () => useApiMutation((id: string) => api.endAddon(id), ["members"])
export const useUpdateSettings = () =>
  useApiMutation((s: GymSettings) => api.updateSettings(s), ["settings"])
