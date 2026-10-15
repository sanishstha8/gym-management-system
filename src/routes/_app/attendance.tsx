import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { CalendarCheck, Clock, Download, ShieldX, Users } from "lucide-react"
import { useMemo } from "react"
import { z } from "zod"

import { EmptyState, ListSkeleton, PageHeader, StatCard } from "@/components/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { attendanceQuery } from "@/data/queries"
import { downloadCsv } from "@/lib/csv"
import { addDaysISO, todayISO } from "@/lib/domain"
import { formatDateTime, methodLabels } from "@/lib/format"
import type { AttendanceRow, CheckInMethod } from "@/lib/types"

const methodOptions = ["all", "card", "qr", "fingerprint", "assisted", "gate"] as const

export const Route = createFileRoute("/_app/attendance")({
  validateSearch: z.object({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    method: z.enum(methodOptions).optional(),
    result: z.enum(["all", "accepted", "denied"]).optional(),
  }),
  component: AttendancePage,
})

const columns: ColumnDef<AttendanceRow>[] = [
  {
    header: "Time",
    accessorKey: "checkedInAt",
    cell: ({ getValue }) => <span className="tabular-nums">{formatDateTime(getValue<string>())}</span>,
  },
  {
    header: "Member",
    id: "member",
    cell: ({ row: { original: a } }) =>
      a.memberId ? (
        <Link to="/members/$memberId" params={{ memberId: a.memberId }} className="font-medium hover:underline">
          {a.memberName}
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">{a.memberCode}</span>
        </Link>
      ) : (
        <span className="text-muted-foreground">
          Unknown <span className="font-mono text-xs">{a.credentialValue}</span>
        </span>
      ),
  },
  { header: "Method", accessorKey: "method", cell: ({ getValue }) => methodLabels[getValue<CheckInMethod>()] },
  {
    header: "Result",
    id: "result",
    cell: ({ row: { original: a } }) =>
      a.result === "accepted" ? (
        <Badge variant="outline" className="border-success/20 bg-success/10 text-success">
          Accepted
        </Badge>
      ) : (
        <span className="flex flex-col items-start gap-0.5">
          <Badge variant="destructive">Denied</Badge>
          <span className="text-xs text-muted-foreground">{a.denyReason}</span>
        </span>
      ),
  },
]

function AttendancePage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const today = todayISO()
  const from = search.from ?? today
  const to = search.to ?? today
  const method = search.method ?? "all"
  const result = search.result ?? "all"
  const { data = [], isPending } = useQuery(attendanceQuery(from, to))

  const rows = useMemo(
    () => data.filter((a) => (method === "all" || a.method === method) && (result === "all" || a.result === result)),
    [data, method, result],
  )
  const accepted = data.filter((a) => a.result === "accepted")
  const unique = new Set(accepted.map((a) => a.memberId)).size
  const byHour = new Map<number, number>()
  for (const a of accepted) {
    const h = new Date(a.checkedInAt).getHours()
    byHour.set(h, (byHour.get(h) ?? 0) + 1)
  }
  const peak = [...byHour.entries()].sort((a, b) => b[1] - a[1])[0]
  const peakLabel = peak
    ? new Date(2000, 0, 1, peak[0]).toLocaleTimeString([], { hour: "numeric" })
    : "—"

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
    autoResetPageIndex: true,
  })

  const preset = from === today && to === today ? "today" : to === today && from === addDaysISO(today, -6) ? "7" : to === today && from === addDaysISO(today, -29) ? "30" : ""

  const set = (patch: Partial<typeof search>) => navigate({ search: (p) => ({ ...p, ...patch }), replace: true })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Workspace"
        title="Attendance"
        description="Every scan at the entrance — accepted and denied."
        actions={
          <Button
            variant="outline"
            disabled={rows.length === 0}
            onClick={() =>
              downloadCsv(
                `attendance-${from}-to-${to}.csv`,
                ["Time", "Member", "Code", "Method", "Result", "Reason"],
                rows.map((a) => [
                  formatDateTime(a.checkedInAt),
                  a.memberName,
                  a.memberCode,
                  methodLabels[a.method],
                  a.result,
                  a.denyReason,
                ]),
              )
            }
          >
            <Download data-icon="inline-start" />
            Export CSV
          </Button>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <ToggleGroup
          type="single"
          variant="outline"
          value={preset}
          onValueChange={(v) => {
            if (v === "today") set({ from: undefined, to: undefined })
            if (v === "7") set({ from: addDaysISO(today, -6), to: today })
            if (v === "30") set({ from: addDaysISO(today, -29), to: today })
          }}
        >
          <ToggleGroupItem value="today">Today</ToggleGroupItem>
          <ToggleGroupItem value="7">7 days</ToggleGroupItem>
          <ToggleGroupItem value="30">30 days</ToggleGroupItem>
        </ToggleGroup>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label="From"
            value={from}
            max={to}
            onChange={(e) => e.target.value && set({ from: e.target.value })}
            className="w-auto"
          />
          <span className="text-muted-foreground">→</span>
          <Input
            type="date"
            aria-label="To"
            value={to}
            min={from}
            max={today}
            onChange={(e) => e.target.value && set({ to: e.target.value })}
            className="w-auto"
          />
        </div>
        <div className="flex gap-2 lg:ml-auto">
          <Select value={method} onValueChange={(v) => set({ method: v === "all" ? undefined : (v as typeof method) })}>
            <SelectTrigger className="w-36" aria-label="Method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {methodOptions.map((m) => (
                <SelectItem key={m} value={m}>
                  {m === "all" ? "All methods" : methodLabels[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={result} onValueChange={(v) => set({ result: v === "all" ? undefined : (v as typeof result) })}>
            <SelectTrigger className="w-32" aria-label="Result">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All results</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="denied">Denied</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Visits" value={accepted.length} hint="Accepted check-ins" icon={CalendarCheck} loading={isPending} />
        <StatCard label="Unique members" value={unique} hint="Different people" icon={Users} loading={isPending} />
        <StatCard
          label="Denied"
          value={data.length - accepted.length}
          hint="Expired, frozen or unknown"
          icon={ShieldX}
          loading={isPending}
        />
        <StatCard label="Busiest hour" value={peakLabel} hint="Most check-ins" icon={Clock} loading={isPending} />
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        {isPending ? (
          <ListSkeleton rows={8} />
        ) : rows.length === 0 ? (
          <EmptyState icon={CalendarCheck} title="No check-ins in this range" />
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
              {rows.length} records · page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
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
    </div>
  )
}
