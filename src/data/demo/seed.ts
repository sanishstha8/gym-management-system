import { addDaysISO, todayISO } from "@/lib/domain"
import type {
  Addon,
  AttendanceRecord,
  CheckInMethod,
  Credential,
  FollowUpNote,
  Gender,
  GymSettings,
  Member,
  MemberAddon,
  Membership,
  Payment,
  Plan,
  Reminder,
} from "@/lib/types"

export interface DemoDb {
  version: 1
  plans: Plan[]
  members: Member[]
  credentials: Credential[]
  memberships: Membership[]
  payments: Payment[]
  attendance: AttendanceRecord[]
  reminders: Reminder[]
  addons: Addon[]
  memberAddons: MemberAddon[]
  notes: FollowUpNote[]
  gateSessions: { code: string; expiresAt: string }[]
  settings: GymSettings
}

/** Small deterministic PRNG so every fresh demo looks the same. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const people: [string, Gender][] = [
  ["Aarav Shrestha", "male"],
  ["Sujata Thapa", "female"],
  ["Niraj Maharjan", "male"],
  ["Sushma Gurung", "female"],
  ["Bikash Tamang", "male"],
  ["Roshni Adhikari", "female"],
  ["Sagar Poudel", "male"],
  ["Anisha Karki", "female"],
  ["Prakash Rai", "male"],
  ["Kritika Basnet", "female"],
  ["Rohan Bhandari", "male"],
  ["Smriti Joshi", "female"],
  ["Dipesh Magar", "male"],
  ["Pooja Lama", "female"],
  ["Suman KC", "male"],
  ["Asmita Ghimire", "female"],
  ["Nabin Khadka", "male"],
  ["Rachana Pandey", "female"],
  ["Kiran Shahi", "male"],
  ["Manisha Dahal", "female"],
  ["Ujjwal Bista", "male"],
  ["Srijana Koirala", "female"],
  ["Abhishek Neupane", "male"],
  ["Elina Sherpa", "female"],
  ["Hari Pradhan", "male"],
  ["Laxmi Chaudhary", "female"],
]

/**
 * Days until expiry for each seeded member, chosen so the dashboard has a mix
 * of healthy, expiring, expired and frozen members out of the box.
 */
const daysLeftByIndex = [1, 2, 3, 45, 60, 20, 33, 5, 7, -2, -9, 120, 80, 15, 200, 25, 6, -20, 90, 40, 10, 150, -40, 70, 28, 300]
/** Members who have stopped visiting, so the follow-up list is populated. */
const absentDaysByIndex: Record<number, number> = { 3: 16, 4: 17, 5: 18, 6: 19, 13: 22 }

function hex(rand: () => number, len: number) {
  return Array.from({ length: len }, () => Math.floor(rand() * 16).toString(16)).join("").toUpperCase()
}

export function createSeed(): DemoDb {
  const rand = mulberry32(2026)
  const today = todayISO()
  const now = new Date()

  const plans: Plan[] = [
    { id: "plan-monthly", name: "Monthly", durationDays: 30, priceNpr: 2500, active: true },
    { id: "plan-quarterly", name: "Quarterly", durationDays: 90, priceNpr: 7500, active: true },
    { id: "plan-half", name: "Half-yearly", durationDays: 180, priceNpr: 13500, active: true },
    { id: "plan-yearly", name: "Yearly", durationDays: 365, priceNpr: 24000, active: true },
  ]

  const addons: Addon[] = [
    { id: "addon-locker", name: "Personal locker", priceNpr: 500, active: true },
    { id: "addon-pt", name: "Personal trainer", priceNpr: 6000, active: true },
    { id: "addon-towel", name: "Towel service", priceNpr: 300, active: true },
    { id: "addon-diet", name: "Diet consultation", priceNpr: 1500, active: true },
  ]

  const members: Member[] = []
  const credentials: Credential[] = []
  const memberships: Membership[] = []
  const payments: Payment[] = []
  const attendance: AttendanceRecord[] = []
  const memberAddons: MemberAddon[] = []

  people.forEach(([fullName, gender], i) => {
    const id = `mem-${String(i + 1).padStart(3, "0")}`
    const plan = plans[i % 4 === 3 ? 3 : i % 3]!
    const daysLeft = daysLeftByIndex[i]!
    const endDate = addDaysISO(today, daysLeft)
    const startDate = addDaysISO(endDate, -(plan.durationDays - 1))
    const joinedOn = addDaysISO(startDate, -Math.floor(rand() * 400))
    const phone = `98${String(Math.floor(10000000 + rand() * 89999999))}`

    members.push({
      id,
      memberCode: `SG-${String(1001 + i)}`,
      fullName,
      phone,
      email: i % 3 === 0 ? `${fullName.split(" ")[0]!.toLowerCase()}@example.com` : null,
      gender,
      dob: addDaysISO(today, -Math.floor(365 * (19 + rand() * 25))),
      emergencyContact: null,
      notes: null,
      photoUrl: null,
      status: i === 20 ? "frozen" : "active",
      joinedOn,
      portalToken: hex(rand, 24).toLowerCase(),
    })

    const membershipId = `ms-${id}`
    memberships.push({
      id: membershipId,
      memberId: id,
      planId: plan.id,
      startDate,
      endDate,
      amountNpr: plan.priceNpr,
      createdAt: `${startDate}T09:00:00.000Z`,
    })
    payments.push({
      id: `pay-${id}`,
      memberId: id,
      membershipId,
      amountNpr: plan.priceNpr,
      method: (["cash", "esewa", "khalti", "bank"] as const)[i % 4],
      note: null,
      paidAt: `${startDate}T09:05:00.000Z`,
    })

    credentials.push({
      id: `cred-qr-${id}`,
      memberId: id,
      type: "qr",
      value: hex(rand, 24).toLowerCase(),
      label: "Personal QR",
      active: true,
      createdAt: `${joinedOn}T09:00:00.000Z`,
    })
    if (i % 5 !== 4) {
      credentials.push({
        id: `cred-card-${id}`,
        memberId: id,
        type: "card",
        value: hex(rand, 8),
        label: "RFID card",
        active: true,
        createdAt: `${joinedOn}T09:00:00.000Z`,
      })
    }
    if (i % 2 === 0) {
      credentials.push({
        id: `cred-fp-${id}`,
        memberId: id,
        type: "fingerprint",
        value: `FP-${String(i + 1).padStart(4, "0")}`,
        label: "Right thumb",
        active: true,
        createdAt: `${joinedOn}T09:00:00.000Z`,
      })
    }
    if (i % 4 === 0) {
      memberAddons.push({ id: `ma-${id}`, memberId: id, addonId: "addon-locker", startDate, endDate: null })
    }
    if (i % 7 === 1) {
      memberAddons.push({ id: `ma-pt-${id}`, memberId: id, addonId: "addon-pt", startDate, endDate: null })
    }

    // Visit history for the past 28 days: ~3-4 visits a week while the membership was valid.
    const absentFor = absentDaysByIndex[i] ?? 0
    for (let back = 28; back >= 1; back--) {
      const day = addDaysISO(today, -back)
      if (day > endDate || day < startDate || back < absentFor || members[i]!.status === "frozen") continue
      if (rand() > 0.5) continue
      const hour = 5 + Math.floor(rand() * 15)
      const minute = Math.floor(rand() * 60)
      const at = new Date(`${day}T00:00:00`)
      at.setHours(hour, minute)
      const methods: CheckInMethod[] = ["card", "qr", "fingerprint", "card", "assisted"]
      const method = methods[Math.floor(rand() * methods.length)]!
      attendance.push({
        id: `att-${id}-${back}`,
        memberId: id,
        method,
        result: "accepted",
        denyReason: null,
        credentialValue: null,
        checkedInAt: at.toISOString(),
      })
    }
  })

  // A few check-ins earlier today so the dashboard feels alive.
  for (const [n, idx] of [0, 1, 2, 7, 11].entries()) {
    const at = new Date(now.getTime() - (n + 1) * 37 * 60_000)
    if (at.toDateString() !== now.toDateString()) continue
    attendance.push({
      id: `att-today-${idx}`,
      memberId: members[idx]!.id,
      method: (["card", "qr", "fingerprint", "card", "qr"] as const)[n],
      result: "accepted",
      denyReason: null,
      credentialValue: null,
      checkedInAt: at.toISOString(),
    })
  }

  attendance.sort((a, b) => a.checkedInAt.localeCompare(b.checkedInAt))

  return {
    version: 1,
    plans,
    members,
    credentials,
    memberships,
    payments,
    attendance,
    reminders: [],
    addons,
    memberAddons,
    notes: [],
    gateSessions: [],
    settings: {
      gymName: "Shrawn Gym",
      reminderDays: [7, 3, 0],
      followUpAfterDays: 14,
      duplicateWindowMinutes: 30,
    },
  }
}
