import { useMemo, useRef, useState, useEffect } from 'react'

type CourseNode = { id: string; name?: string; hours?: string; section?: string }

const NODE_W = 76
const NODE_H = 32
const RADIUS_STEP = 170
const CENTER_SPREAD = 50

function computeRadialLayout(
  nodes: CourseNode[],
  edges: Array<{ source: string; target: string }>,
  cx: number,
  cy: number
) {
  const nodeIds = new Set(nodes.map((n) => n.id))
  const filteredEdges = edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))

  // in-degree and outgoing edges
  const inDegree = new Map<string, number>()
  const outEdges = new Map<string, string[]>()
  nodes.forEach((n) => { inDegree.set(n.id, 0); outEdges.set(n.id, []) })
  filteredEdges.forEach((e) => {
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
    outEdges.get(e.source)?.push(e.target)
  })

  // roots = no incoming edges = no prereqs inside this degree
  const roots = nodes.filter((n) => inDegree.get(n.id) === 0).map((n) => n.id)

  // BFS to assign layers
  const layer = new Map<string, number>()
  const queue = [...roots]
  roots.forEach((r) => layer.set(r, 0))
  while (queue.length > 0) {
    const curr = queue.shift()!
    const currLayer = layer.get(curr)!
    for (const next of outEdges.get(curr) ?? []) {
      if (!layer.has(next)) {
        layer.set(next, currLayer + 1)
        queue.push(next)
      }
    }
  }
  // any node not reached (disconnected) gets its own layer
  nodes.forEach((n) => { if (!layer.has(n.id)) layer.set(n.id, 0) })

  // group by layer
  const layerGroups = new Map<number, string[]>()
  layer.forEach((l, id) => {
    if (!layerGroups.has(l)) layerGroups.set(l, [])
    layerGroups.get(l)!.push(id)
  })

  // compute positions
  const positions = new Map<string, { x: number; y: number }>()
  layerGroups.forEach((ids, l) => {
    if (l === 0) {
      // center ring — small cluster
      ids.forEach((id, i) => {
        const angle = ids.length === 1 ? 0 : (i / ids.length) * 2 * Math.PI - Math.PI / 2
        const r = ids.length === 1 ? 0 : CENTER_SPREAD
        positions.set(id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) })
      })
    } else {
      const r = l * RADIUS_STEP
      ids.forEach((id, i) => {
        const angle = (i / ids.length) * 2 * Math.PI - Math.PI / 2
        positions.set(id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) })
      })
    }
  })

  const maxLayer = Math.max(...Array.from(layer.values()), 0)
  const svgSize = (maxLayer + 1) * RADIUS_STEP * 2 + 200

  return { positions, filteredEdges, svgSize, layerGroups }
}

export function RadialView({
  nodes,
  edges,
  completed,
  onSelectCourse,
}: {
  nodes: CourseNode[]
  edges: Array<{ source: string; target: string }>
  completed: Set<string>
  onSelectCourse: (id: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 900, h: 700 })
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const dragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(() => {
      setDims({ w: containerRef.current!.clientWidth, h: containerRef.current!.clientHeight })
    })
    ro.observe(containerRef.current)
    setDims({ w: containerRef.current.clientWidth, h: containerRef.current.clientHeight })
    return () => ro.disconnect()
  }, [])

  const cx = dims.w / 2
  const cy = dims.h / 2

  const { positions, filteredEdges, svgSize } = useMemo(
    () => computeRadialLayout(nodes, edges, cx, cy),
    [nodes, edges, cx, cy]
  )

  // pan
  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as SVGElement).closest('.radial-node')) return
    dragging.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return
    setOffset((prev) => ({
      x: prev.x + (e.clientX - lastPos.current.x),
      y: prev.y + (e.clientY - lastPos.current.y),
    }))
    lastPos.current = { x: e.clientX, y: e.clientY }
  }
  const onMouseUp = () => { dragging.current = false }

  // zoom
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    setScale((prev) => Math.min(2, Math.max(0.3, prev - e.deltaY * 0.001)))
  }

  return (
    <div
      ref={containerRef}
      className="radial-container"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onWheel={onWheel}
    >
      {/* zoom controls */}
      <div className="radial-zoom-controls">
        <button onClick={() => setScale((s) => Math.min(2, s + 0.15))}>+</button>
        <button onClick={() => setScale((s) => Math.max(0.3, s - 0.15))}>−</button>
        <button onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }) }}>↺</button>
      </div>

      <svg
        width={dims.w}
        height={dims.h}
        style={{ display: 'block', cursor: dragging.current ? 'grabbing' : 'grab' }}
      >
        <defs>
          <marker id="rad-arrow" viewBox="0 -4 8 8" refX="7" refY="0" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0,-4L8,0L0,4" fill="#94a3b8" />
          </marker>
        </defs>

        <g transform={`translate(${offset.x}, ${offset.y}) scale(${scale})`}>
          {/* edges */}
          {filteredEdges.map((e, i) => {
            const src = positions.get(e.source)
            const tgt = positions.get(e.target)
            if (!src || !tgt) return null
            // midpoint control point pulled toward center for curves
            const mx = (src.x + tgt.x) / 2 + (cx - (src.x + tgt.x) / 2) * 0.1
            const my = (src.y + tgt.y) / 2 + (cy - (src.y + tgt.y) / 2) * 0.1
            // offset target to edge of node rect
            const dx = tgt.x - src.x
            const dy = tgt.y - src.y
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            const tx = tgt.x - (dx / dist) * (NODE_W / 2 + 4)
            const ty = tgt.y - (dy / dist) * (NODE_H / 2 + 4)
            return (
              <path
                key={i}
                d={`M${src.x},${src.y} Q${mx},${my} ${tx},${ty}`}
                fill="none"
                stroke="#94a3b8"
                strokeWidth={1.2}
                strokeOpacity={0.55}
                markerEnd="url(#rad-arrow)"
              />
            )
          })}

          {/* nodes */}
          {nodes.map((node) => {
            const pos = positions.get(node.id)
            if (!pos) return null
            const done = completed.has(node.id)
            const x = pos.x - NODE_W / 2
            const y = pos.y - NODE_H / 2
            return (
              <g
                key={node.id}
                className="radial-node"
                onClick={() => onSelectCourse(node.id)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x={x} y={y}
                  width={NODE_W} height={NODE_H}
                  rx={NODE_RX}
                  fill={done ? '#dcfce7' : '#ffffff'}
                  stroke={done ? '#16a34a' : '#c8102e'}
                  strokeWidth={done ? 2 : 1.5}
                  filter="url(#shadow)"
                />
                <text
                  x={pos.x} y={pos.y - 4}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={9}
                  fontWeight={600}
                  fontFamily="'DM Mono', monospace"
                  fill={done ? '#16a34a' : '#c8102e'}
                  style={{ pointerEvents: 'none' }}
                >
                  {node.id}
                </text>
                {node.name && (
                  <text
                    x={pos.x} y={pos.y + 8}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={7}
                    fill="#64748b"
                    style={{ pointerEvents: 'none' }}
                  >
                    {node.name.length > 18 ? node.name.slice(0, 16) + '…' : node.name}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}

const NODE_RX = 6