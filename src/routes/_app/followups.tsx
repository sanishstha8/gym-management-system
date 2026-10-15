import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { HeartHandshake, NotebookPen, Phone } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { AccessBadge, EmptyState, ListSkeleton, MemberAvatar, PageHeader } from "@/components/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { membersQuery, notesQuery, settingsQuery, useAddNote } from "@/data/queries"
import { daysSinceVisit, needsFollowUp } from "@/lib/domain"
import { formatDate, formatRelative } from "@/lib/format"
import type { FollowUpNote, MemberSummary } from "@/lib/types"

export const Route = createFileRoute("/_app/followups")({
  component: FollowUpsPage,
})

function FollowUpsPage() {
  const members = useQuery(membersQuery)
  const settings = useQuery(settingsQuery)
  const notes = useQuery(notesQuery)
  const after = settings.data?.followUpAfterDays ?? 14

  const list = (members.data ?? [])
    .filter((m) => needsFollowUp(m, after))
    .sort((a, b) => daysSinceVisit(b) - daysSinceVisit(a))
  const latestNote = new Map<string, FollowUpNote>()
  for (const n of notes.data ?? []) if (!latestNote.has(n.memberId)) latestNote.set(n.memberId, n)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Workspace"
        title="Follow-up list"
        description={`Members with active access who haven't visited in ${after}+ days. A friendly call often brings them back.`}
      />
      <Card className="gap-0 overflow-hidden py-0">
        {members.isPending ? (
          <ListSkeleton rows={6} />
        ) : list.length === 0 ? (
          <EmptyState icon={HeartHandshake} title="Nobody needs a follow-up right now">
            Members who stop visiting for {after} days will appear here.
          </EmptyState>
        ) : (
          <ul className="divide-y">
            {list.map((m) => (
              <FollowUpRow key={m.id} member={m} note={latestNote.get(m.id)} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function FollowUpRow({ member: m, note }: { member: MemberSummary; note?: FollowUpNote }) {
  const [writing, setWriting] = useState(false)
  const [text, setText] = useState("")
  const add = useAddNote()

  return (
    <li className="flex flex-col gap-3 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <MemberAvatar name={m.fullName} photoUrl={m.photoUrl} />
        <div className="min-w-0 flex-1">
          <Link to="/members/$memberId" params={{ memberId: m.id }} className="text-sm font-medium hover:underline">
            {m.fullName}
          </Link>
          <p className="text-xs text-muted-foreground">
            Last visit {m.lastVisit ? formatDate(m.lastVisit) : "never"} · {m.planName} until{" "}
            {formatDate(m.currentMembership?.endDate)}
          </p>
        </div>
        <Badge variant="outline" className="border-warning/30 bg-warning-soft text-warning">
          {daysSinceVisit(m)} days away
        </Badge>
        <AccessBadge access={m.access} daysLeft={m.daysLeft} />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild>
            <a href={`tel:${m.phone}`}>
              <Phone data-icon="inline-start" />
              {m.phone}
            </a>
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setWriting((w) => !w)}>
            <NotebookPen data-icon="inline-start" />
            Note
          </Button>
        </div>
      </div>
      {note && !writing && (
        <p className="ml-12 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          “{note.note}” — {formatRelative(note.createdAt)}
        </p>
      )}
      {writing && (
        <form
          className="ml-12 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!text.trim()) return
            add.mutate(
              { memberId: m.id, note: text },
              {
                onSuccess: () => {
                  toast.success("Note saved")
                  setText("")
                  setWriting(false)
                },
              },
            )
          }}
        >
          <Input
            autoFocus
            placeholder="e.g. Called — back next week after exams"
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label={`Note for ${m.fullName}`}
          />
          <Button type="submit" size="sm" disabled={!text.trim() || add.isPending}>
            Save
          </Button>
        </form>
      )}
    </li>
  )
}
