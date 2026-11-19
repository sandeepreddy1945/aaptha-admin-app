export type GraphDataPoint = {
  month: string
  orders: number
  revenue: number
}

export type GraphToolOutput = {
  data: GraphDataPoint[]
  description: string
  series: string[]
  title: string
  type: "graph"
}

export class DummyGraphData {
  static readonly description = "A dummy monthly revenue and order trend."
  static readonly series = ["revenue", "orders"] as const
  static readonly values: readonly GraphDataPoint[] = [
    { month: "Jan", orders: 186, revenue: 18600 },
    { month: "Feb", orders: 205, revenue: 21400 },
    { month: "Mar", orders: 237, revenue: 24800 },
    { month: "Apr", orders: 221, revenue: 23100 },
    { month: "May", orders: 278, revenue: 29600 },
    { month: "Jun", orders: 304, revenue: 32800 },
  ]

  static getGraph(title = "Monthly performance"): GraphToolOutput {
    return {
      data: this.values.map((point) => ({ ...point })),
      description: this.description,
      series: [...this.series],
      title,
      type: "graph",
    }
  }
}

export const isGraphToolOutput = (value: unknown): value is GraphToolOutput => {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const graph = value as Partial<GraphToolOutput>
  return (
    graph.type === "graph" &&
    typeof graph.title === "string" &&
    typeof graph.description === "string" &&
    Array.isArray(graph.data)
  )
}
