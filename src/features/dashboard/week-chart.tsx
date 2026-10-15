import { format, parseISO } from "date-fns"
import { Bar, BarChart, Cell, LabelList, XAxis } from "recharts"

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { todayISO } from "@/lib/domain"

const config = {
  count: { label: "Check-ins", color: "var(--chart-2)" },
} satisfies ChartConfig

export function WeekChart({ week }: { week: { date: string; count: number }[] }) {
  const today = todayISO()
  const data = week.map((d) => ({ ...d, day: format(parseISO(d.date), "EEE") }))

  return (
    <ChartContainer config={config} className="aspect-auto h-44 w-full">
      <BarChart data={data} margin={{ top: 20, left: 4, right: 4 }}>
        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator />} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={28}>
          {data.map((d) => (
            <Cell key={d.date} fill={d.date === today ? "var(--chart-1)" : "var(--color-count)"} />
          ))}
          <LabelList dataKey="count" position="top" offset={6} fontSize={11} className="fill-muted-foreground" />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
