import { useId, useMemo, useState, useCallback, useRef } from "react"
import {
  sankey as d3Sankey,
  sankeyLinkHorizontal,
  sankeyLeft,
} from "d3-sankey"
import type {
  SankeyGraph,
  SankeyNode as D3SankeyNode,
  SankeyLink as D3SankeyLink,
} from "d3-sankey"
import { useComputedColorScheme } from "@mantine/core"
import { CHART_COLORS as COLORS } from "../constants"
import { formatEur } from "../utils/format"
import type { SankeyData as SankeyApiData } from "../api/client"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NodeExtra {
  id: string
  name: string
  value: number
  fill: string
}
interface LinkExtra {
  value: number
}

type SNode = D3SankeyNode<NodeExtra, LinkExtra>
type SLink = D3SankeyLink<NodeExtra, LinkExtra>
type Graph = SankeyGraph<NodeExtra, LinkExtra>

type HoverTarget =
  | { kind: "node"; id: string }
  | { kind: "link"; idx: number }
  | null

interface TooltipState {
  x: number
  y: number
  lines: string[]
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

const NODE_WIDTH = 14
const NODE_PAD = 24
const MIN_LABEL_HEIGHT = 14

function buildGraph(data: SankeyApiData): Graph | null {
  const nodeIndex = new Map<string, number>()
  const nodes = data.nodes.map((n, i) => {
    nodeIndex.set(n.id, i)
    return { id: n.id, name: n.name, value: n.value, fill: n.color ?? COLORS[i % COLORS.length] }
  })

  const links: Array<{ source: string; target: string; value: number }> = []
  for (const l of data.links) {
    if (!nodeIndex.has(l.source) || !nodeIndex.has(l.target) || l.source === l.target || l.value <= 0) continue
    links.push({ source: l.source, target: l.target, value: l.value })
  }

  if (nodes.length === 0) return null

  // Deep clone — d3-sankey mutates in place
  return {
    nodes: nodes.map((n) => ({ ...n })),
    links: links.map((l) => ({ ...l })),
  } as Graph
}

function computeLayout(
  graph: Graph,
  width: number,
  height: number,
  marginLeft: number,
  marginRight: number,
) {
  const layout = d3Sankey<NodeExtra, LinkExtra>()
    .nodeId((d) => d.id)
    .nodeWidth(NODE_WIDTH)
    .nodePadding(NODE_PAD)
    .nodeAlign(sankeyLeft)
    .nodeSort(null)
    .extent([
      [marginLeft, 20],
      [width - marginRight, height - 20],
    ])

  return layout(graph)
}

/** Pre-compute connectivity maps for fast hover lookups */
function buildConnectivity(links: readonly SLink[]) {
  const nodeToLinks = new Map<string, Set<number>>()
  const linkToNodes = new Map<number, [string, string]>()

  links.forEach((link, i) => {
    const srcId = (link.source as SNode).id
    const tgtId = (link.target as SNode).id
    linkToNodes.set(i, [srcId, tgtId])
    if (!nodeToLinks.has(srcId)) nodeToLinks.set(srcId, new Set())
    if (!nodeToLinks.has(tgtId)) nodeToLinks.set(tgtId, new Set())
    nodeToLinks.get(srcId)!.add(i)
    nodeToLinks.get(tgtId)!.add(i)
  })

  return { nodeToLinks, linkToNodes }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function NodeRect({
  node,
  containerWidth,
  marginLeft,
  marginRight,
  textColor,
  dimmed,
  highlighted,
  onEnter,
  onLeave,
  onMove,
}: {
  node: SNode
  containerWidth: number
  marginLeft: number
  marginRight: number
  textColor: string
  dimmed: boolean
  highlighted: boolean
  onEnter: () => void
  onLeave: () => void
  onMove: (e: React.MouseEvent) => void
}) {
  const x0 = node.x0 ?? 0
  const x1 = node.x1 ?? 0
  const y0 = node.y0 ?? 0
  const y1 = node.y1 ?? 0
  const h = y1 - y0

  const isRightHalf = x0 > (containerWidth - marginLeft - marginRight) / 2 + marginLeft
  const labelX = isRightHalf ? x0 - 8 : x1 + 8
  const anchor = isRightHalf ? "end" : "start"
  const label = `${node.name}  ${formatEur(node.value)}`

  const opacity = dimmed ? 0.25 : highlighted ? 1 : 0.85

  return (
    <g
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onMouseMove={onMove}
      style={{ cursor: "pointer" }}
    >
      <rect
        x={x0}
        y={y0}
        width={x1 - x0}
        height={Math.max(h, 1)}
        fill={node.fill}
        fillOpacity={opacity}
        rx={2}
        style={{ transition: "fill-opacity 0.15s" }}
      />
      {/* Invisible wider hit area for thin nodes */}
      <rect
        x={x0 - 4}
        y={y0}
        width={x1 - x0 + 8}
        height={Math.max(h, 6)}
        fill="transparent"
      />
      {h >= MIN_LABEL_HEIGHT && (
        <text
          x={labelX}
          y={y0 + h / 2}
          textAnchor={anchor}
          dominantBaseline="central"
          fontSize={13}
          fontWeight={highlighted ? 700 : 600}
          fill={textColor}
          opacity={dimmed ? 0.35 : 1}
          style={{ pointerEvents: "none", userSelect: "none", transition: "opacity 0.15s" }}
        >
          {label}
        </text>
      )}
    </g>
  )
}

function LinkPath({
  link,
  idx,
  gradientPrefix,
  dimmed,
  highlighted,
  onEnter,
  onLeave,
  onMove,
}: {
  link: SLink
  idx: number
  gradientPrefix: string
  dimmed: boolean
  highlighted: boolean
  onEnter: () => void
  onLeave: () => void
  onMove: (e: React.MouseEvent) => void
}) {
  const pathGen = sankeyLinkHorizontal()
  const d = pathGen(link as any)
  if (!d) return null

  const src = link.source as SNode
  const tgt = link.target as SNode
  const gradientId = `${gradientPrefix}-lg-${idx}`
  const w = Math.max(link.width ?? 1, 1.5)

  const srcOpacity = dimmed ? 0.04 : highlighted ? 0.7 : 0.45
  const tgtOpacity = dimmed ? 0.02 : highlighted ? 0.5 : 0.25
  const strokeOpacity = dimmed ? 0.15 : highlighted ? 1 : 0.7

  return (
    <g
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onMouseMove={onMove}
      style={{ cursor: "pointer" }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={src.fill} stopOpacity={srcOpacity} />
          <stop offset="100%" stopColor={tgt.fill} stopOpacity={tgtOpacity} />
        </linearGradient>
      </defs>
      <path
        d={d}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={highlighted ? w + 2 : w}
        strokeOpacity={strokeOpacity}
        style={{ transition: "stroke-width 0.15s, stroke-opacity 0.15s" }}
      />
      {/* Wider invisible hit area for thin links */}
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(w, 10)}
      />
    </g>
  )
}

function Tooltip({ state, isDark }: { state: TooltipState | null; isDark: boolean }) {
  if (!state) return null

  return (
    <div
      style={{
        position: "absolute",
        left: state.x + 14,
        top: state.y - 10,
        pointerEvents: "none",
        backgroundColor: isDark ? "rgba(30, 30, 36, 0.95)" : "rgba(255, 255, 255, 0.96)",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"}`,
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 13,
        fontWeight: 500,
        color: isDark ? "#e0e0e0" : "#222",
        boxShadow: isDark
          ? "0 4px 16px rgba(0,0,0,0.5)"
          : "0 4px 16px rgba(0,0,0,0.12)",
        zIndex: 100,
        whiteSpace: "nowrap",
        maxWidth: 320,
      }}
    >
      {state.lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  data: SankeyApiData
  width?: number
  height?: number
}

export function SankeyChart({ data, width = 900, height = 500 }: Props) {
  const uid = useId()
  const colorScheme = useComputedColorScheme("dark")
  const isDark = colorScheme === "dark"
  const textColor = isDark ? "#c9cdd1" : "#333"
  const containerRef = useRef<HTMLDivElement>(null)

  const [hover, setHover] = useState<HoverTarget>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  // Estimate margins from longest label per side
  const marginLeft = useMemo(() => {
    const leftNodes = data.nodes.filter(
      (n) => !data.links.some((l) => l.target === n.id),
    )
    const maxLen = Math.max(0, ...leftNodes.map((n) => `${n.name}  ${formatEur(n.value)}`.length))
    return Math.min(Math.max(maxLen * 7.5 + 16, 80), 260)
  }, [data])

  const marginRight = useMemo(() => {
    const rightNodes = data.nodes.filter(
      (n) => !data.links.some((l) => l.source === n.id),
    )
    const maxLen = Math.max(0, ...rightNodes.map((n) => `${n.name}  ${formatEur(n.value)}`.length))
    return Math.min(Math.max(maxLen * 7.5 + 16, 80), 260)
  }, [data])

  const layout = useMemo(() => {
    const graph = buildGraph(data)
    if (!graph) return null
    return computeLayout(graph, width, height, marginLeft, marginRight)
  }, [data, width, height, marginLeft, marginRight])

  const connectivity = useMemo(
    () => (layout ? buildConnectivity(layout.links) : null),
    [layout],
  )

  // Derive highlight sets from current hover target
  const { highlightedNodes, highlightedLinks } = useMemo(() => {
    const hn = new Set<string>()
    const hl = new Set<number>()
    if (!hover || !connectivity) return { highlightedNodes: hn, highlightedLinks: hl }

    if (hover.kind === "node") {
      hn.add(hover.id)
      const linkedIdxs = connectivity.nodeToLinks.get(hover.id)
      if (linkedIdxs) {
        for (const li of linkedIdxs) {
          hl.add(li)
          const [s, t] = connectivity.linkToNodes.get(li)!
          hn.add(s)
          hn.add(t)
        }
      }
    } else {
      hl.add(hover.idx)
      const pair = connectivity.linkToNodes.get(hover.idx)
      if (pair) {
        hn.add(pair[0])
        hn.add(pair[1])
      }
    }
    return { highlightedNodes: hn, highlightedLinks: hl }
  }, [hover, connectivity])

  const hasHover = hover != null

  const updateTooltip = useCallback((e: React.MouseEvent, lines: string[]) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, lines })
  }, [])

  const clearHover = useCallback(() => {
    setHover(null)
    setTooltip(null)
  }, [])

  if (!layout || layout.nodes.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--mantine-color-dimmed)" }}>
        No data — add salary and expenses to see the diagram
      </div>
    )
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`Budget flow: ${data.nodes.length} categories across income and expenses`}
        style={{ display: "block" }}
        onMouseLeave={clearHover}
      >
        <g>
          {layout.links.map((link, i) => {
            const src = link.source as SNode
            const tgt = link.target as SNode
            return (
              <LinkPath
                key={i}
                link={link}
                idx={i}
                gradientPrefix={uid}
                dimmed={hasHover && !highlightedLinks.has(i)}
                highlighted={highlightedLinks.has(i)}
                onEnter={() => setHover({ kind: "link", idx: i })}
                onLeave={clearHover}
                onMove={(e) =>
                  updateTooltip(e, [
                    `${src.name} → ${tgt.name}`,
                    formatEur(link.value),
                  ])
                }
              />
            )
          })}
        </g>
        <g>
          {layout.nodes.map((node) => (
            <NodeRect
              key={node.id}
              node={node}
              containerWidth={width}
              marginLeft={marginLeft}
              marginRight={marginRight}
              textColor={textColor}
              dimmed={hasHover && !highlightedNodes.has(node.id)}
              highlighted={highlightedNodes.has(node.id)}
              onEnter={() => setHover({ kind: "node", id: node.id })}
              onLeave={clearHover}
              onMove={(e) => {
                const incoming = (node.targetLinks as SLink[]) ?? []
                const outgoing = (node.sourceLinks as SLink[]) ?? []
                const lines = [`${node.name}  —  ${formatEur(node.value)}`]
                if (incoming.length > 0) {
                  lines.push(`← ${incoming.map((l) => (l.source as SNode).name).join(", ")}`)
                }
                if (outgoing.length > 0) {
                  lines.push(`→ ${outgoing.map((l) => (l.target as SNode).name).join(", ")}`)
                }
                updateTooltip(e, lines)
              }}
            />
          ))}
        </g>
      </svg>
      <Tooltip state={tooltip} isDark={isDark} />
    </div>
  )
}
