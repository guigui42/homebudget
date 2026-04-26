import { useMemo } from "react"
import {
  Sankey,
  Tooltip,
  Layer,
  Rectangle,
} from "recharts"
import type { SankeyData as SankeyApiData } from "../api/client"

// Map API data to recharts Sankey format
function toRechartsData(data: SankeyApiData) {
  const nodeIndex = new Map<string, number>()
  const nodes = data.nodes.map((n, i) => {
    nodeIndex.set(n.id, i)
    return { name: n.name, value: n.value, fill: n.color }
  })

  const links = data.links
    .map((l) => ({
      source: nodeIndex.get(l.source)!,
      target: nodeIndex.get(l.target)!,
      value: l.value,
    }))
    .filter((l) => l.source !== undefined && l.target !== undefined)

  return { nodes, links }
}

const COLORS = [
  "#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f",
  "#edc948", "#b07aa1", "#ff9da7", "#9c755f", "#bab0ac",
]

function SankeyNode(props: any) {
  const { x, y, width, height, index, payload } = props
  const fill = payload.fill || COLORS[index % COLORS.length]
  return (
    <Layer key={`node-${index}`}>
      <Rectangle x={x} y={y} width={width} height={height} fill={fill} fillOpacity={0.9} />
      <text
        x={x + width + 6}
        y={y + height / 2}
        textAnchor="start"
        dominantBaseline="central"
        fontSize={12}
        fill="#333"
      >
        {payload.name} — €{payload.value.toLocaleString()}
      </text>
    </Layer>
  )
}

interface Props {
  data: SankeyApiData
  width?: number
  height?: number
}

export function SankeyChart({ data, width = 800, height = 500 }: Props) {
  const chartData = useMemo(() => toRechartsData(data), [data])

  if (chartData.nodes.length === 0) {
    return <div style={{ padding: 40, textAlign: "center", color: "#888" }}>No data — add salary and expenses to see the diagram</div>
  }

  return (
    <Sankey
      width={width}
      height={height}
      data={chartData}
      node={<SankeyNode />}
      nodePadding={30}
      nodeWidth={10}
      linkCurvature={0.5}
      margin={{ top: 20, right: 180, bottom: 20, left: 20 }}
    >
      <Tooltip
        formatter={(value: number) => `€${value.toLocaleString()}`}
      />
    </Sankey>
  )
}
