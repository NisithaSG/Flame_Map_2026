import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import * as d3 from 'd3'
import * as dagre from 'dagre'
import './index.css'

type GraphNode = d3.SimulationNodeDatum & { id: string }
type GraphLink = { source: string; target: string }

export default function App() {
  const [majors, setMajors] = useState<
    Array<{ id: string; name: string; label: string }>
  >([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const normalizedQuery = query.trim().toLowerCase()
  const [selectedMajorId, setSelectedMajorId] = useState<string | null>(null)
  const [resultsOpen, setResultsOpen] = useState(false)
  const [graphData, setGraphData] = useState<{
    degree_id: string
    nodes: Array<{ id: string; name?: string; hours?: string; section?: string }>
    edges: Array<{ source: string; target: string }>
  } | null>(null)
  const [graphLoading, setGraphLoading] = useState(false)
  const [graphError, setGraphError] = useState('')
  const [showGraph, setShowGraph] = useState(false)
  const [layoutMode, setLayoutMode] = useState<'flow' | 'force'>('flow')
  const [zoomScale, setZoomScale] = useState(1.3)
  const graphRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const loadMajors = async () => {
      try {
        const response = await fetch('http://localhost:8000/degrees')
        if (!response.ok) {
          throw new Error(`Failed to load majors: ${response.status}`)
        }
        const data = (await response.json()) as Array<{
          name: string
          degree_id: string
        }>
        const list = data
          .map((degree) => {
            const rawName = (degree.name || '').trim()
            const isGeneric =
              !rawName || rawName.toLowerCase() === 'academic catalog'
            const fallback = degree.degree_id
              .replace(/-/g, ' ')
              .replace(/\b\w/g, (letter) => letter.toUpperCase())
            return {
              id: degree.degree_id,
              name: rawName,
              label: isGeneric ? fallback : rawName,
            }
          })
          .sort((a, b) => a.label.localeCompare(b.label))
        setMajors(list)
        setLoadError('')
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to load majors.'
        setLoadError(message)
      } finally {
        setIsLoading(false)
      }
    }

    loadMajors()
  }, [])

  const matches = useMemo(() => {
    if (!normalizedQuery) return []
    const filtered = majors.filter((major) =>
      major.label.toLowerCase().includes(normalizedQuery)
    )
    return filtered.sort((a, b) => {
      const aLower = a.label.toLowerCase()
      const bLower = b.label.toLowerCase()
      const aPrefix = aLower.startsWith(normalizedQuery)
      const bPrefix = bLower.startsWith(normalizedQuery)
      if (aPrefix !== bPrefix) return aPrefix ? -1 : 1
      return aLower.localeCompare(bLower)
    })
  }, [normalizedQuery])

  const highlightMatch = (text: string, term: string) => {
    const lowerText = text.toLowerCase()
    const lowerTerm = term.toLowerCase()
    const index = lowerText.indexOf(lowerTerm)
    if (index === -1 || !term) return text
    const before = text.slice(0, index)
    const match = text.slice(index, index + term.length)
    const after = text.slice(index + term.length)
    return (
      <>
        {before}
        <mark>{match}</mark>
        {after}
      </>
    )
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!matches.length) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((prev) => (prev + 1) % matches.length)
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((prev) => (prev - 1 + matches.length) % matches.length)
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const chosen = matches[activeIndex]
      if (chosen) {
        setQuery(chosen.label)
        setSelectedMajorId(chosen.id)
        setResultsOpen(false)
      }
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setQuery('')
      setSelectedMajorId(null)
      setResultsOpen(false)
    }
  }

  const handleBuildMap = async () => {
    const fallback = majors.find(
      (major) => major.label.toLowerCase() === normalizedQuery
    )
    const degreeId = selectedMajorId ?? fallback?.id

    if (!degreeId) {
      setGraphError('Please select a major from the suggestions first.')
      setShowGraph(true)
      return
    }

    try {
      setGraphLoading(true)
      setGraphError('')
      setShowGraph(true)
      setTimeout(() => {
        const mapSection = document.getElementById('map')
        mapSection?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 0)
      const response = await fetch(
        `http://localhost:8000/degrees/${degreeId}/graph`
      )
      if (!response.ok) {
        throw new Error(`Graph request failed: ${response.status}`)
      }
      const data = (await response.json()) as {
        degree_id: string
        nodes: Array<{
          id: string
          name?: string
          hours?: string
          section?: string
        }>
        edges: Array<{ source: string; target: string }>
      }
      setGraphData(data)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to load graph.'
      setGraphError(message)
      setGraphData(null)
    } finally {
      setGraphLoading(false)
    }
  }

  useEffect(() => {
    if (!graphData || !graphRef.current) return

    const container = graphRef.current
    container.innerHTML = ''
    const width = container.clientWidth || 900
    const height = 560
    const padding = 24
    const nodeRadius = 12
    const labelOffset = 18
    const labelWidth = 48
    const minX = padding + nodeRadius
    const maxX = width - padding - nodeRadius - labelOffset - labelWidth
    const minY = padding + nodeRadius
    const maxY = height - padding - nodeRadius

    const nodeMap = new Map<string, GraphNode>()
    const courseInfo = new Map<string, { hours?: string; name?: string }>()
    graphData.nodes.forEach((node) => {
      if (!nodeMap.has(node.id)) nodeMap.set(node.id, { id: node.id })
      if (!courseInfo.has(node.id)) {
        courseInfo.set(node.id, { hours: node.hours, name: node.name })
      }
    })
    const nodes = Array.from(nodeMap.values())
    const nodeIds = new Set(nodes.map((node) => node.id))
    const links: GraphLink[] = graphData.edges
      .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
      .map((edge) => ({ source: edge.source, target: edge.target }))

    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')

    svg
      .append('defs')
      .append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 16)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#4b5563')

    const clipRect = svg
      .append('defs')
      .append('clipPath')
      .attr('id', 'graph-clip')
      .append('rect')
      .attr('x', padding)
      .attr('y', padding)
      .attr('width', width - padding * 2)
      .attr('height', height - padding * 2)

    const viewport = svg
      .append('g')
      .attr('clip-path', 'url(#graph-clip)')

    const linkGroup = viewport
      .append('g')
      .attr('stroke', '#4b5563')
      .attr('stroke-opacity', 0.6)
      .attr('fill', 'none')

    if (layoutMode === 'flow') {
      const parseLevel = (id: string) => {
        const match = id.match(/(\d{3})/)
        if (!match) return 0
        const num = Number(match[1])
        if (Number.isNaN(num)) return 0
        return Math.floor(num / 100) * 100
      }

      const graph = new dagre.graphlib.Graph()
      graph.setGraph({
        rankdir: 'TB',
        ranksep: 120,
        nodesep: 36,
        marginx: padding,
        marginy: padding,
      })
      graph.setDefaultEdgeLabel(() => ({}))

      nodes.forEach((node) => {
        const rank = parseLevel(node.id)
        graph.setNode(node.id, { width: 60, height: 30, rank })
      })

      links.forEach((edge) => {
        graph.setEdge(edge.source as string, edge.target as string)
      })

      dagre.layout(graph)

      const graphWidth = graph.graph().width ?? width
      const graphHeight = graph.graph().height ?? height
      const baseScale =
        Math.min(
          (width - padding * 2) / graphWidth,
          (height - padding * 2) / graphHeight
        ) * 0.98
      const totalScale = baseScale * zoomScale
      const scaledWidth = graphWidth * totalScale + padding * 2
      const scaledHeight = graphHeight * totalScale + padding * 2
      const canvasWidth = Math.max(width, scaledWidth)
      const canvasHeight = Math.max(height, scaledHeight)

      svg
        .attr('width', canvasWidth)
        .attr('height', canvasHeight)
        .attr('viewBox', `0 0 ${canvasWidth} ${canvasHeight}`)

      clipRect
        .attr('width', canvasWidth - padding * 2)
        .attr('height', canvasHeight - padding * 2)

      const offsetX = padding
      const offsetY = padding

      const flowRoot = viewport
        .append('g')
        .attr('transform', `translate(${offsetX}, ${offsetY}) scale(${totalScale})`)

      const edgePath = flowRoot
        .append('g')
        .attr('stroke', '#4b5563')
        .attr('stroke-opacity', 0.6)
        .attr('fill', 'none')
        .selectAll('path')
        .data(links)
        .enter()
        .append('path')
        .attr('stroke-width', 1.2)
        .attr('marker-end', 'url(#arrow)')
        .attr('d', (d: GraphLink) => {
          const edge = graph.edge(d.source as string, d.target as string)
          if (!edge || !edge.points) return ''
          const line = d3.line<[number, number]>().curve(d3.curveMonotoneY)
          const points = (edge.points as Array<{ x: number; y: number }>).map(
            (point) => [point.x, point.y] as [number, number]
          )
          return line(points) || ''
        })

      const flowNodes = flowRoot
        .append('g')
        .selectAll('g')
        .data(nodes)
        .enter()
        .append('g')
        .attr('transform', (d: GraphNode) => {
          const dagNode = graph.node(d.id)
          return dagNode ? `translate(${dagNode.x}, ${dagNode.y})` : ''
        })

      flowNodes
        .append('circle')
        .attr('r', nodeRadius)
        .attr('fill', '#c8102e')

      flowNodes
        .append('text')
        .text((d: GraphNode) => d.id)
        .attr('x', 18)
        .attr('y', 4)
        .attr('font-size', '10px')
        .attr('fill', '#0f172a')

      flowNodes
        .append('title')
        .text((d: GraphNode) => {
          const info = courseInfo.get(d.id)
          const name = info?.name ? ` — ${info.name}` : ''
          const hours = info?.hours ? ` — ${info.hours} credits` : ''
          return `${d.id}${name}${hours}`
        })

      return () => {
        edgePath.remove()
      }
    }

    const link = linkGroup
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke-width', 1.2)
      .attr('marker-end', 'url(#arrow)')

    const node = viewport
      .append('g')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')

    node
      .append('circle')
      .attr('r', nodeRadius)
      .attr('fill', '#c8102e')

    node
      .append('text')
      .text((d: GraphNode) => d.id)
      .attr('x', 18)
      .attr('y', 4)
      .attr('font-size', '10px')
      .attr('fill', '#0f172a')

    node
      .append('title')
      .text((d: GraphNode) => {
        const info = courseInfo.get(d.id)
        const name = info?.name ? ` — ${info.name}` : ''
        const hours = info?.hours ? ` — ${info.hours} credits` : ''
        return `${d.id}${name}${hours}`
      })

    const collisionRadius = 34
    const simulation = d3
      .forceSimulation(nodes as GraphNode[])
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d: GraphNode) => d.id)
          .distance(110)
      )
      .force('charge', d3.forceManyBody().strength(-260))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(collisionRadius))

    node.call(
      d3
        .drag<SVGGElement, GraphNode>()
        .on('start', (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          event.subject.fx = event.subject.x
          event.subject.fy = event.subject.y
        })
        .on('drag', (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>) => {
          const clampedX = Math.max(minX, Math.min(maxX, event.x))
          const clampedY = Math.max(minY, Math.min(maxY, event.y))
          event.subject.fx = clampedX
          event.subject.fy = clampedY
        })
        .on('end', (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>) => {
          if (!event.active) simulation.alphaTarget(0)
          event.subject.fx = null
          event.subject.fy = null
        })
    )

    const clamp = (value: number, min: number, max: number) =>
      Math.max(min, Math.min(max, value))

    simulation.on('tick', () => {
      nodes.forEach((d) => {
        d.x = clamp(d.x ?? width / 2, minX, maxX)
        d.y = clamp(d.y ?? height / 2, minY, maxY)
      })

      link
        .attr('x1', (d: d3.SimulationLinkDatum<GraphNode>) => (d.source as GraphNode).x ?? 0)
        .attr('y1', (d: d3.SimulationLinkDatum<GraphNode>) => (d.source as GraphNode).y ?? 0)
        .attr('x2', (d: d3.SimulationLinkDatum<GraphNode>) => (d.target as GraphNode).x ?? 0)
        .attr('y2', (d: d3.SimulationLinkDatum<GraphNode>) => (d.target as GraphNode).y ?? 0)

      node.attr(
        'transform',
        (d: GraphNode) => `translate(${d.x ?? 0}, ${d.y ?? 0})`
      )
    })

    return () => {
      simulation.stop()
    }
  }, [graphData, layoutMode, zoomScale])

  return (
    <main className="page">
      <section className="hero" id="top">
        <div className="band band--top" aria-hidden="true" />
        <div className="hero__inner">
          <h1>UIC Flame Map</h1>
          <p className="lead">
            An organized visual for your degree at UIC. Explore every course and
            see prerequisites.
          </p>
          <div className="hero__actions">
            <a className="btn btn--primary" href="#flowchart">
              Create my Flowchart
            </a>
            <a className="btn btn--ghost" href="#learn">
              Learn More
            </a>
          </div>
        </div>
        <div className="band band--bottom" aria-hidden="true" />
      </section>

      <section className="section section--flow" id="flowchart">
        <div className="section__inner">
          <div className="section__header">
            <p className="eyebrow">Start Here</p>
            <h2>Choose Your Major</h2>
            <p className="section__lead">
              We'll load the courses and build your visual flowchart instantly.
            </p>
          </div>

          <div className="flow-card">
            <label htmlFor="major-search" className="field__label">
              Major or Program
            </label>
            <div className="field__row">
              <div className="search">
                <input
                  id="major-search"
                  name="major-search"
                  type="text"
                  placeholder="Search for a major"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setSelectedMajorId(null)
                    setActiveIndex(0)
                    setResultsOpen(true)
                  }}
                  onKeyDown={handleKeyDown}
                  onFocus={() => {
                    if (normalizedQuery.length > 0) setResultsOpen(true)
                  }}
                  onBlur={() => {
                    setTimeout(() => setResultsOpen(false), 120)
                  }}
                  disabled={isLoading || !!loadError}
                />
                {normalizedQuery.length > 0 && resultsOpen && (
                  <div className="search__results">
                    {matches.length === 0 ? (
                      <span className="search__empty">
                        No matches yet. Try another keyword.
                      </span>
                    ) : (
                      matches.map((major, index) => (
                        <button
                          key={major.id}
                          className={`search__item${
                            index === activeIndex ? ' is-active' : ''
                          }`}
                          type="button"
                          onClick={() => {
                            setQuery(major.label)
                            setSelectedMajorId(major.id)
                            setResultsOpen(false)
                          }}
                          onMouseEnter={() => setActiveIndex(index)}
                        >
                          {highlightMatch(major.label, query)}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <button className="btn btn--primary" type="button" onClick={handleBuildMap}>
                Build My Map
              </button>
            </div>
            <p className="hint">
              {isLoading
                ? 'Loading majors from the UIC catalog...'
                : loadError
                ? `Error: ${loadError} (Is the backend running?)`
                : selectedMajorId
                ? `Selected: ${selectedMajorId}`
                : 'Start typing to see suggested majors.'}
            </p>
          </div>
        </div>
      </section>

      {showGraph && (
        <section className="section section--graph" id="map">
          <div className="section__inner">
            <div className="section__header">
              <p className="eyebrow">Your Flowchart</p>
              <h2>Course Map Preview</h2>
              <p className="section__lead">
                Drag nodes to explore the prerequisite flow.
              </p>
            </div>

            <div className="graph-controls">
              <button
                className={`btn btn--ghost${layoutMode === 'flow' ? ' is-active' : ''}`}
                type="button"
                onClick={() => setLayoutMode('flow')}
              >
                Flowchart Layout
              </button>
              <button
                className={`btn btn--ghost${layoutMode === 'force' ? ' is-active' : ''}`}
                type="button"
                onClick={() => setLayoutMode('force')}
              >
                Force Layout
              </button>
              {layoutMode === 'flow' && (
                <button
                  className="btn btn--ghost"
                  type="button"
                  onClick={() => setZoomScale((prev) => Math.min(2, prev + 0.2))}
                >
                  Zoom In
                </button>
              )}
              {layoutMode === 'flow' && zoomScale > 1 && (
                <button
                  className="btn btn--ghost"
                  type="button"
                  onClick={() => setZoomScale((prev) => Math.max(1, prev - 0.2))}
                >
                  Zoom Out
                </button>
              )}
            </div>

            <div className="graph-card">
              {graphLoading && <p className="graph-status">Loading graph...</p>}
              {graphError && <p className="graph-status graph-status--error">{graphError}</p>}
              {!graphLoading && !graphError && (
                <div className="graph-canvas" ref={graphRef} />
              )}
            </div>
          </div>
        </section>
      )}

      <section className="section section--learn" id="learn">
        <div className="section__inner">
          <div className="section__header">
            <p className="eyebrow">How It Works</p>
            <h2>From Catalog to Flowchart</h2>
            <p className="section__lead">
              We pull official UIC catalog data and map out prerequisites so you
              can plan semester by semester.
            </p>
          </div>

          <div className="steps">
            <article className="step">
              <h3>1. Pick Your Program</h3>
              <p>
                Select your degree or concentration.
              </p>
            </article>
            <article className="step">
              <h3>2. See the Graph</h3>
              <p>
                An interactive map that shows which courses unlock the next
                ones.
              </p>
            </article>
            <article className="step">
              <h3>3. Plan Your Path</h3>
              <p>
                Mark completed courses to highlight what is available next.
              </p>
            </article>
          </div>
        </div>
      </section>
    </main>
  )
}
