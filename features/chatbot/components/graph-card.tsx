"use client"

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { GraphToolOutput } from "./dummy-graph-data"

const graphChartConfig = {
  orders: {
    color: "var(--chart-2)",
    label: "Orders",
  },
  revenue: {
    color: "var(--chart-1)",
    label: "Revenue",
  },
} satisfies ChartConfig

export type GraphCardProps = {
  graph: GraphToolOutput
}

export function GraphCard({ graph }: GraphCardProps) {
  return (
    <Card className="w-full overflow-hidden">
      <CardHeader>
        <CardTitle>{graph.title}</CardTitle>
        <CardDescription>{graph.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          className="aspect-auto h-[280px] w-full"
          config={graphChartConfig}
        >
          <LineChart
            accessibilityLayer
            data={graph.data}
            margin={{ left: 8, right: 12, top: 8 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="month"
              tickLine={false}
              tickMargin={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              tickFormatter={(value: number) =>
                value >= 1000 ? `${value / 1000}k` : String(value)
              }
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              dataKey="revenue"
              dot={false}
              stroke="var(--color-revenue)"
              strokeWidth={2}
              type="monotone"
            />
            <Line
              dataKey="orders"
              dot={false}
              stroke="var(--color-orders)"
              strokeWidth={2}
              type="monotone"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
