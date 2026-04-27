import { useMemo } from "react"
import {
  Sankey,
  Tooltip,
  Layer,
  Rectangle,
} from "recharts"
import { useComputedColorScheme } from "@mantine/core"
import { CHART_COLORS as COLORS } from "../constants"
import type { SankeyData as SankeyApiData } from "../api/client"

// Map API data to recharts Sankey format
function toRechartsData(data: SankeyApiData) {
  const nodeIndex = new Map<string, number>()
  const nodes = data.nodes.map((n, i) => {
    nodeIndex.set(n.id, i)
    return { name: n.name, value: n.value, fill: n.color, id: n.id }
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

// Recharts does not export types for custom Sankey node/link render props
function SankeyNode(props: any) {
  const { x, y, width, height, index, payload, containerWidth } = props
  const fill = payload.fill || COLORS[index % COLORS.length]

  const isRightSide = x > (containerWidth ?? 900) / 2
  const labelX = isRightSide ? x - 8 : x + width + 8
  const anchor = isRightSide ? "end" : "start"

  const label = `${payload.name}  €${payload.value.toLocaleString()}`

  return (
    <Layer key={`node-${index}`}>
      <Rectangle x={x} y={y} width={width} height={height} fill={fill} fillOpacity={0.9} />
      <text
        x={labelX}
        y={y + height / 2}
        textAnchor={anchor}
        dominantBaseline="central"
        fontSize={13}
        fontWeight={600}
        fill="currentColor"
        className="sankey-label"
      >
        {label}
      </text>
    </Layer>
  )
}

// Recharts does not export types for custom Sankey node/link render props
function SankeyLink(props: any) {
  const {
    sourceX, sourceY, sourceControlX, targetX, targetY, targetControlX,
    linkWidth, index, payload,
  } = props

  // Get source node color
  const sourceNode = payload?.source
  const sourceIndex = sourceNode?.index ?? index
  const color = sourceNode?.fill || COLORS[sourceIndex % COLORS.length]

  const gradientId = `link-gradient-${index}`

  // Get target node color
  const targetNode = payload?.target
  const targetIndex = targetNode?.index ?? index
  const targetColor = targetNode?.fill || COLORS[targetIndex % COLORS.length]

  return (
    <Layer key={`link-${index}`}>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity={0.5} />
          <stop offset="100%" stopColor={targetColor} stopOpacity={0.3} />
        </linearGradient>
      </defs>
      <path
        d={`
          M${sourceX},${sourceY}
          C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}
        `}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={Math.max(linkWidth, 2)}
        strokeOpacity={0.7}
      />
    </Layer>
  )
}

interface Props {
  data: SankeyApiData
  width?: number
  height?: number
}

export function SankeyChart({ data, width = 900, height = 500 }: Props) {
  const chartData = useMemo(() => toRechartsData(data), [data])
  const colorScheme = useComputedColorScheme("dark")
  const textColor = colorScheme === "dark" ? "#c9cdd1" : "#333"

  if (chartData.nodes.length === 0) {
    return <div style={{ padding: 40, textAlign: "center", color: "#888" }}>No data — add salary and expenses to see the diagram</div>
  }

  return (
    <div style={{ color: textColor }}>
      <Sankey
        width={width}
        height={height}
        data={chartData}
        node={<SankeyNode containerWidth={width} />}
        link={<SankeyLink />}
        nodePadding={40}
        nodeWidth={12}
        linkCurvature={0.5}
        margin={{ top: 20, right: 200, bottom: 20, left: 200 }}
      >
        <Tooltip
          formatter={(value) => [`€${Number(value).toLocaleString()}`, "Amount"]}
          contentStyle={{
            backgroundColor: colorScheme === "dark" ? "#2C2E33" : "#fff",
            border: "1px solid #555",
            borderRadius: 8,
            color: textColor,
          }}
        />
      </Sankey>
    </div>
  )
}
