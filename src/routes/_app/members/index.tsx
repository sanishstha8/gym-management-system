import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import { ArrowUpDown, CreditCard, Fingerprint, QrCode, Search, UserPlus, Users } from "lucide-react"
import { useMemo, useState } from "react"
import { z } from "zod"

import { AccessBadge, EmptyState, ListSkeleton, MemberAvatar, PageHeader } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { membersQuery, plansQuery } from "@/data/queries"
import { MemberFormDialog } from "@/features/members/member-form-dialog"
import { RenewDialog } from "@/features/renewals/renew-dialog"
import { formatDate, formatRelative } from "@/lib/format"
import type { AccessStatus, CredentialType, MemberSummary } from "@/lib/types"

const filters = ["all", "active", "expiring", "expired", "frozen", "archived"] as const
type Filter = (typeof filters)[number]

export const Route = createFileRoute("/_app/members/")({
  validateSearch: z.object({
    q: z.string().optional(),
    filter: z.enum(filters).optional(),
    new: z.boolean().optional(),
  }),
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(plansQuery)
    return context.queryClient.ensureQueryData(membersQuery)
  },
  component: MembersPage,
})

const credentialIcons: Record<CredentialType, typeof QrCode> = { card: CreditCard, qr: QrCode, fingerprint: Fingerprint }
const credentialNames: Record<CredentialType, string> = { card: "RFID card", qr: "QR code", fingerprint: "Thumbprint" }

function matchesFilter(access: AccessStatus, filter: Filter) {
  if (filter === "all") return access !== "archived"
  if (filter === "active") return access === "active" || access === "expiring"
  if (filter === "expired") return access === "expired" || access === "none"
  return access === filter
}

const columns: ColumnDef<MemberSummary>[] = [
  {
    id: "member",
    accessorFn: (m) => m.fullName,
    header: ({ column }) => (
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => column.toggleSorting()}>
        Member
        <ArrowUpDown data-icon="inline-end" />
      </Button>
    ),
    cell: ({ row: { original: m } }) => (
      <Link to="/members/$memberId" params={{ memberId: m.id }} className="flex items-center gap-3 hover:underline">
        <MemberAvatar name={m.fullName} photoUrl={m.photoUrl} />
        <div className="min-w-0">
          <p className="truncate font-medium">{m.fullName}</p>
          <p className="text-xs text-muted-foreground">{m.memberCode}</p>
        </div>
      </Link>
    ),
  },
  { accessorKey: "phone", header: "Phone", cell: ({ getValue }) => <span className="tabular-nums">{getValue<string>()}</span> },
  { accessorKey: "planName", header: "Plan", cell: ({ getValue }) => getValue<string | null>() ?? "—" },
  {
    id: "expiry",
    accessorFn: (m) => m.daysLeft ?? -9999,
    header: ({ column }) => (
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => column.toggleSorting()}>
        Expiry
        <ArrowUpDown data-icon="inline-end" />
      </Button>
    ),
    cell: ({ row: { original: m } }) => (
      <div className="flex flex-col items-start gap-1">
        <span className="text-xs text-muted-foreground">{formatDate(m.currentMembership?.endDate)}</span>
        <AccessBadge access={m.access} daysLeft={m.daysLeft} />
      </div>
    ),
  },
  {
    id: "lastVisit",
    accessorFn: (m) => m.lastVisit ?? "",
    header: ({ column }) => (
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => column.toggleSorting()}>
        Last visit
        <ArrowUpDown data-icon="inline-end" />
      </Button>
    ),
    cell: ({ row: { original: m } }) => <span className="text-muted-foreground">{formatRelative(m.lastVisit)}</span>,
  },
  {
    id: "access",
    header: "Access",
    enableSorting: false,
    cell: ({ row: { original: m } }) => (
      <div className="flex gap-1.5">
        {(["card", "qr", "fingerprint"] as const).map((type) => {
          const Icon = credentialIcons[type]
          const has = m.credentialTypes.includes(type)
          return (
            <Tooltip key={type}>
              <TooltipTrigger asChild>
                <span
                  className={has ? "text-primary" : "text-muted-foreground/35"}
                  aria-label={`${credentialNames[type]}: ${has ? "enrolled" : "not enrolled"}`}
                >
                  <Icon className="size-4" />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {credentialNames[type]} {has ? "enrolled" : "not enrolled"}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row: { original: m } }) => (
      <div className="flex justify-end gap-2">
        {(m.access === "expiring" || m.access === "expired" || m.access === "none") && (
          <RenewDialog
            member={m}
            trigger={
              <Button size="sm" variant="outline">
                Renew
              </Button>
            }
          />
        )}
        <Button size="sm" variant="ghost" asChild>
          <Link to="/members/$memberId" params={{ memberId: m.id }}>
            Open
          </Link>
        </Button>
      </div>
    ),
  },
]

function MembersPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { data: members = [], isPending } = useQuery(membersQuery)
  const [sorting, setSorting] = useState<SortingState>([{ id: "member", desc: false }])
  const filter = search.filter ?? "all"
  const q = search.q ?? ""

  const rows = useMemo(() => members.filter((m) => matchesFilter(m.access, filter)), [members, filter])
  const counts = useMemo(
    () => Object.fromEntries(filters.map((f) => [f, members.filter((m) => matchesFilter(m.access, f)).length])),
    [members],
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter: q },
    onSortingChange: setSorting,
    globalFilterFn: (row, _id, value: string) => {
      const needle = value.toLowerCase().trim()
      const m = row.original
      return [m.fullName, m.memberCode, m.phone, m.email ?? ""].some((s) => s.toLowerCase().includes(needle))
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 15 } },
    autoResetPageIndex: true,
  })

  const setSearch = (patch: Partial<typeof search>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Workspace"
        title="Members"
        description={`${counts.active ?? 0} with active access · ${members.length} total`}
        actions={
          <Button onClick={() => setSearch({ new: true })}>
            <UserPlus data-icon="inline-start" />
            Add member
          </Button>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={filter} onValueChange={(v) => setSearch({ filter: v === "all" ? undefined : (v as Filter) })}>
          <TabsList className="h-auto flex-wrap">
            {filters.map((f) => (
              <TabsTrigger key={f} value={f} className="capitalize">
                {f}
                <span className="ml-1 text-xs text-muted-foreground tabular-nums">{counts[f]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <InputGroup className="lg:max-w-xs">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search name, code, phone…"
            value={q}
            onChange={(e) => setSearch({ q: e.target.value || undefined })}
            aria-label="Search members"
          />
        </InputGroup>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        {isPending ? (
          <ListSkeleton rows={8} />
        ) : table.getRowModel().rows.length === 0 ? (
          <EmptyState icon={Users} title={q ? `No members match "${q}"` : "No members here yet"}>
            {!q && "Add your first member to get started."}
          </EmptyState>
        ) : (
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="bg-muted/40 hover:bg-muted/40">
                  {hg.headers.map((h) => (
                    <TableHead key={h.id} className="px-4">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-4 py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {table.getPageCount() > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
            <span>
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                Previous
              </Button>
              <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {search.new && (
        <MemberFormDialog
          open
          onOpenChange={(open) => !open && setSearch({ new: undefined })}
          onCreated={(id) => navigate({ to: "/members/$memberId", params: { memberId: id } })}
        />
      )}
    </div>
  )
}
