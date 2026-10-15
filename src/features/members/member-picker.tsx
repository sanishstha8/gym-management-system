import { useQuery } from "@tanstack/react-query"

import { AccessBadge, MemberAvatar } from "@/components/shared"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { membersQuery } from "@/data/queries"
import type { MemberSummary } from "@/lib/types"

/** Searchable member list (name, code or phone). */
export function MemberPicker({
  onSelect,
  filter,
  placeholder = "Search by name, code or phone…",
}: {
  onSelect: (member: MemberSummary) => void
  filter?: (member: MemberSummary) => boolean
  placeholder?: string
}) {
  const { data: members = [], isPending } = useQuery(membersQuery)
  const visible = members.filter((m) => m.status !== "archived" && (!filter || filter(m)))

  return (
    <Command className="rounded-lg border">
      <CommandInput placeholder={placeholder} autoFocus />
      <CommandList className="max-h-72">
        <CommandEmpty>{isPending ? "Loading members…" : "No member found."}</CommandEmpty>
        <CommandGroup>
          {visible.map((m) => (
            <CommandItem
              key={m.id}
              value={`${m.fullName} ${m.memberCode} ${m.phone}`}
              onSelect={() => onSelect(m)}
              className="gap-3"
            >
              <MemberAvatar name={m.fullName} photoUrl={m.photoUrl} className="size-7" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.fullName}</p>
                <p className="text-xs text-muted-foreground">
                  {m.memberCode} · {m.phone}
                </p>
              </div>
              <AccessBadge access={m.access} daysLeft={m.daysLeft} />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}
