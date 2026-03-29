import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import * as d3 from 'd3'
import * as dagre from 'dagre'
import { RadialView } from './RadialView'
import './index.css'

type GraphNode = d3.SimulationNodeDatum & { id: string }
type GraphLink = { source: string; target: string }

type CourseNode = {
  id: string
  name?: string
  hours?: string
  section?: string
}

type CourseDetail = {
  course_id: string
  name: string
  hours: string
  prerequisites: string
  description: string
}

// ─── Path View ───────────────────────────────────────────────────────────────

function PathView({
  nodes,
  edges,
  completed,
  onToggle,
}: {
  nodes: CourseNode[]
  edges: Array<{ source: string; target: string }>
  completed: Set<string>
  onToggle: (id: string) => void
}) {
  const [selected, setSelected] = useState<CourseDetail | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  // build adjacency for prereq chains within degree
  const nodeIds = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes])
  const prereqsOf = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const e of edges) {
      if (nodeIds.has(e.source) && nodeIds.has(e.target)) {
        if (!map.has(e.target)) map.set(e.target, [])
        map.get(e.target)!.push(e.source)
      }
    }
    return map
  }, [edges, nodeIds])

  // detect gen-ed sections using exact DB section names
  const isGenEdSection = (sec: string) => {
    const s = sec.toLowerCase().trim()
    return (
      s.includes('general education') ||
      s.includes('general and basic education') ||
      s.includes('basic and general education') ||
      s.includes('basic education') ||
      s.includes('nonengineering and general') ||
      s.includes('university writing requirement') ||
      s.includes('uic first year') ||
      s.includes('uic first-year') ||
      s.includes('first year program') ||
      s.includes('core curriculum') ||
      s.includes('gpa and student teaching') ||
      s.includes('student teaching requirement') ||
      s.includes('semester hour') ||
      s.includes('admission requirement') ||
      s.includes('admission pathway') ||
      s.includes('prerequisite courses') ||
      s.includes('prerequisite and collateral') ||
      s.includes('pre-nursing') ||
      s === 'electives' ||
      s === 'additional electives' ||
      s === 'free electives' ||
      s === 'selectives' ||
      s === 'selectives and electives' ||
      s === 'music selectives' ||
      s === 'experiential learning' ||
      s === 'electives to reach minimum total hours' ||
      s === 'electives outside the department of art' ||
      s === 'electives outside the school of design' ||
      s === 'electives outside of the school of design' ||
      s === 'electives outside the major rubric' ||
      s === 'electives outside the required major rubric' ||
      s === 'elective outside the major rubric' ||
      s === 'english electives' ||
      s === 'english electives to complete minimum major hours' ||
      s === 'business electives' ||
      s === 'additional general education and school requirements' ||
      s === 'additional general education requirements'
    )
  }

  // courses that are prereqs to at least one non-gen-ed course
  const prereqToMajorCourse = useMemo(() => {
    const majorNodeIds = new Set(
      nodes
        .filter((n) => !isGenEdSection(n.section ?? 'Other'))
        .map((n) => n.id)
    )
    const needed = new Set<string>()
    for (const e of edges) {
      if (majorNodeIds.has(e.target)) needed.add(e.source)
    }
    return needed
  }, [nodes, edges])

  // group by section, excluding gen eds unless they're prereqs to major courses
  const sections = useMemo(() => {
    const map = new Map<string, CourseNode[]>()
    console.log("ALL SECTIONS:", [...new Set(nodes.map(n => n.section))])
    for (const node of nodes) {
      const sec = node.section ?? 'Other'
      const isGenEd = isGenEdSection(sec)
      console.log(sec, "->", isGenEd)
      if (isGenEd && !prereqToMajorCourse.has(node.id)) continue
      if (!map.has(sec)) map.set(sec, [])
      map.get(sec)!.push(node)
    }
    return map
  }, [nodes, prereqToMajorCourse])

  const fetchDetail = async (courseId: string) => {
    if (loadingId === courseId) return
    setLoadingId(courseId)
    try {
      const encoded = encodeURIComponent(courseId)
      const res = await fetch(`http://localhost:8000/courses/${encoded}`)
      if (!res.ok) throw new Error('not found')
      const data = (await res.json()) as CourseDetail
      setSelected(data)
    } catch {
      setSelected({
        course_id: courseId,
        name: nodes.find((n) => n.id === courseId)?.name ?? courseId,
        hours: nodes.find((n) => n.id === courseId)?.hours ?? '—',
        prerequisites: prereqsOf.get(courseId)?.join(', ') || 'None',
        description: 'No description available.',
      })
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="path-view">
      {/* Detail panel */}
      {selected && (
        <div className="course-panel">
          <button
            className="course-panel__close"
            onClick={() => setSelected(null)}
            aria-label="Close"
          >
            ✕
          </button>
          <p className="course-panel__id">{selected.course_id}</p>
          <h3 className="course-panel__name">{selected.name}</h3>
          <div className="course-panel__row">
            <span>Credits</span>
            <span>{selected.hours}</span>
          </div>
          <div className="course-panel__row">
            <span>Prerequisites</span>
            <span>{selected.prerequisites || 'None'}</span>
          </div>
          <p className="course-panel__desc">{selected.description}</p>
        </div>
      )}

      {/* Sections */}
      {Array.from(sections.entries()).map(([sectionName, sectionNodes]) => (
        <div key={sectionName} className="path-section">
          <h3 className="path-section__title">{sectionName}</h3>
          <div className="path-section__grid">
            {sectionNodes.map((node) => {
              const prereqs = prereqsOf.get(node.id) ?? []
              const isDone = completed.has(node.id)
              const isLoading = loadingId === node.id
              return (
                <div
                  key={node.id}
                  className={`course-box${isDone ? ' course-box--done' : ''}${isLoading ? ' course-box--loading' : ''}`}
                  onClick={() => fetchDetail(node.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && fetchDetail(node.id)}
                >
                  <div className="course-box__header">
                    <span className="course-box__id">{node.id}</span>
                    <input
                      type="checkbox"
                      className="course-box__check"
                      checked={isDone}
                      onChange={(e) => {
                        e.stopPropagation()
                        onToggle(node.id)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Mark ${node.id} complete`}
                    />
                  </div>
                  <p className="course-box__name">{node.name ?? '—'}</p>
                  <p className="course-box__hours">{node.hours ?? '—'} credits</p>
                  {prereqs.length > 0 && (
                    <p className="course-box__prereqs">
                      Needs: {prereqs.slice(0, 3).join(', ')}
                      {prereqs.length > 3 ? ` +${prereqs.length - 3}` : ''}
                    </p>
                  )}
                  {isLoading && <span className="course-box__spinner" />}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────

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
    nodes: CourseNode[]
    edges: Array<{ source: string; target: string }>
  } | null>(null)
  const [graphLoading, setGraphLoading] = useState(false)
  const [graphError, setGraphError] = useState('')
  const [showGraph, setShowGraph] = useState(false)
  const [layoutMode, setLayoutMode] = useState<'flow' | 'force'>('flow')
  const [zoomScale, setZoomScale] = useState(1.3)
  const [activeView, setActiveView] = useState<'graph' | 'path' | 'radial'>('graph')
  const graphRef = useRef<HTMLDivElement | null>(null)

  // completion tracking — persisted to localStorage
  const [completed, setCompleted] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('flamemap-completed')
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
    } catch {
      return new Set()
    }
  })

  const toggleCompleted = (id: string) => {
    setCompleted((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        localStorage.setItem('flamemap-completed', JSON.stringify([...next]))
      } catch {}
      return next
    })
  }

  // ─── fetchDetail lifted to App scope for RadialView ───────────────────────
  const [radialSelected, setRadialSelected] = useState<CourseDetail | null>(null)

  const fetchDetail = async (courseId: string) => {
    try {
      const encoded = encodeURIComponent(courseId)
      const res = await fetch(`http://localhost:8000/courses/${encoded}`)
      if (!res.ok) throw new Error('not found')
      const data = (await res.json()) as CourseDetail
      setRadialSelected(data)
    } catch {
      setRadialSelected({
        course_id: courseId,
        name: graphData?.nodes.find((n) => n.id === courseId)?.name ?? courseId,
        hours: graphData?.nodes.find((n) => n.id === courseId)?.hours ?? '—',
        prerequisites: 'None',
        description: 'No description available.',
      })
    }
  }

  useEffect(() => {
    const loadMajors = async () => {
      try {
        const response = await fetch('http://localhost:8000/degrees')
        if (!response.ok) throw new Error(`Failed to load majors: ${response.status}`)
        const data = (await response.json()) as Array<{ name: string; degree_id: string }>
        const list = data
          .map((degree) => {
            const rawName = (degree.name || '').trim()
            const isGeneric = !rawName || rawName.toLowerCase() === 'academic catalog'
            const fallback = degree.degree_id
              .replace(/-/g, ' ')
              .replace(/\b\w/g, (l) => l.toUpperCase())
            return { id: degree.degree_id, name: rawName, label: isGeneric ? fallback : rawName }
          })
          .sort((a, b) => a.label.localeCompare(b.label))
        setMajors(list)
        setLoadError('')
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Unable to load majors.')
      } finally {
        setIsLoading(false)
      }
    }
    loadMajors()
  }, [])

  const matches = useMemo(() => {
    if (!normalizedQuery) return []
    return majors
      .filter((m) => m.label.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => {
        const aP = a.label.toLowerCase().startsWith(normalizedQuery)
        const bP = b.label.toLowerCase().startsWith(normalizedQuery)
        if (aP !== bP) return aP ? -1 : 1
        return a.label.localeCompare(b.label)
      })
  }, [normalizedQuery, majors])

  const highlightMatch = (text: string, term: string) => {
    const idx = text.toLowerCase().indexOf(term.toLowerCase())
    if (idx === -1 || !term) return text
    return (
      <>
        {text.slice(0, idx)}
        <mark>{text.slice(idx, idx + term.length)}</mark>
        {text.slice(idx + term.length)}
      </>
    )
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!matches.length) return
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((p) => (p + 1) % matches.length) }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((p) => (p - 1 + matches.length) % matches.length) }
    if (event.key === 'Enter') {
      event.preventDefault()
      const chosen = matches[activeIndex]
      if (chosen) { setQuery(chosen.label); setSelectedMajorId(chosen.id); setResultsOpen(false) }
    }
    if (event.key === 'Escape') { event.preventDefault(); setQuery(''); setSelectedMajorId(null); setResultsOpen(false) }
  }

  const handleBuildMap = async () => {
    const fallback = majors.find((m) => m.label.toLowerCase() === normalizedQuery)
    const degreeId = selectedMajorId ?? fallback?.id
    if (!degreeId) { setGraphError('Please select a major from the suggestions first.'); setShowGraph(true); return }
    try {
      setGraphLoading(true)
      setGraphError('')
      setShowGraph(true)
      setRadialSelected(null)
      setTimeout(() => document.getElementById('map')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
      const response = await fetch(`http://localhost:8000/degrees/${degreeId}/graph`)
      if (!response.ok) throw new Error(`Graph request failed: ${response.status}`)
      const data = (await response.json()) as { degree_id: string; nodes: CourseNode[]; edges: Array<{ source: string; target: string }> }
      setGraphData(data)
    } catch (error) {
      setGraphError(error instanceof Error ? error.message : 'Unable to load graph.')
      setGraphData(null)
    } finally {
      setGraphLoading(false)
    }
  }

  // D3 graph rendering
  useEffect(() => {
    if (!graphData || !graphRef.current || activeView !== 'graph') return
    const container = graphRef.current
    container.innerHTML = ''
    const width = container.clientWidth || 900
    const height = 1400
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
      if (!courseInfo.has(node.id)) courseInfo.set(node.id, { hours: node.hours, name: node.name })
    })
    const nodes = Array.from(nodeMap.values())
    const nodeIds = new Set(nodes.map((n) => n.id))
    const links: GraphLink[] = graphData.edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({ source: e.source, target: e.target }))

    const svg = d3.select(container).append('svg')
      .attr('width', width).attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')

    svg.append('defs').append('marker')
      .attr('id', 'arrow').attr('viewBox', '0 -5 10 10')
      .attr('refX', 16).attr('refY', 0)
      .attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto')
      .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', '#4b5563')

    const clipRect = svg.append('defs').append('clipPath').attr('id', 'graph-clip')
      .append('rect').attr('x', padding).attr('y', padding)
      .attr('width', width - padding * 2).attr('height', height - padding * 2)

    const viewport = svg.append('g').attr('clip-path', 'url(#graph-clip)')
    const linkGroup = viewport.append('g').attr('stroke', '#4b5563').attr('stroke-opacity', 0.6).attr('fill', 'none')

    if (layoutMode === 'flow') {
      const parseLevel = (id: string) => {
        const match = id.match(/(\d{3})/)
        if (!match) return 0
        const num = Number(match[1])
        return Number.isNaN(num) ? 0 : Math.floor(num / 100) * 100
      }
      const graph = new dagre.graphlib.Graph()
      graph.setGraph({ rankdir: 'TB', ranksep: 120, nodesep: 36, marginx: padding, marginy: padding })
      graph.setDefaultEdgeLabel(() => ({}))
      nodes.forEach((node) => graph.setNode(node.id, { width: 60, height: 30, rank: parseLevel(node.id) }))
      links.forEach((edge) => graph.setEdge(edge.source as string, edge.target as string))
      dagre.layout(graph)

      const graphWidth = graph.graph().width ?? width
      const graphHeight = graph.graph().height ?? height
      const baseScale = Math.min((width - padding * 2) / graphWidth, (height - padding * 2) / graphHeight) * 0.98
      const totalScale = baseScale * zoomScale
      const canvasWidth = Math.max(width, graphWidth * totalScale + padding * 2)
      const canvasHeight = Math.max(height, graphHeight * totalScale + padding * 2)

      svg.attr('width', canvasWidth).attr('height', canvasHeight).attr('viewBox', `0 0 ${canvasWidth} ${canvasHeight}`)
      clipRect.attr('width', canvasWidth - padding * 2).attr('height', canvasHeight - padding * 2)

      const flowRoot = viewport.append('g').attr('transform', `translate(${padding}, ${padding}) scale(${totalScale})`)

      flowRoot.append('g').attr('stroke', '#4b5563').attr('stroke-opacity', 0.6).attr('fill', 'none')
        .selectAll('path').data(links).enter().append('path')
        .attr('stroke-width', 1.2).attr('marker-end', 'url(#arrow)')
        .attr('d', (d: GraphLink) => {
          const edge = graph.edge(d.source as string, d.target as string)
          if (!edge?.points) return ''
          const line = d3.line<[number, number]>().curve(d3.curveMonotoneY)
          return line((edge.points as Array<{ x: number; y: number }>).map((p) => [p.x, p.y] as [number, number])) || ''
        })

      const flowNodes = flowRoot.append('g').selectAll('g').data(nodes).enter().append('g')
        .attr('transform', (d: GraphNode) => { const n = graph.node(d.id); return n ? `translate(${n.x}, ${n.y})` : '' })

      flowNodes.append('circle').attr('r', nodeRadius)
        .attr('fill', (d: GraphNode) => completed.has(d.id) ? '#16a34a' : '#c8102e')

      flowNodes.append('text').text((d: GraphNode) => d.id)
        .attr('x', 18).attr('y', 4).attr('font-size', '10px').attr('fill', '#0f172a')

      flowNodes.append('title').text((d: GraphNode) => {
        const info = courseInfo.get(d.id)
        return `${d.id}${info?.name ? ` — ${info.name}` : ''}${info?.hours ? ` — ${info.hours} credits` : ''}`
      })
      return
    }

    const link = linkGroup
      .selectAll<SVGLineElement, d3.SimulationLinkDatum<GraphNode>>('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke-width', 1.2)
      .attr('marker-end', 'url(#arrow)')
    const node = viewport.append('g').selectAll('g').data(nodes).enter().append('g')

    node.append('circle').attr('r', nodeRadius).attr('fill', (d: GraphNode) => completed.has(d.id) ? '#16a34a' : '#c8102e')
    node.append('text').text((d: GraphNode) => d.id).attr('x', 18).attr('y', 4).attr('font-size', '10px').attr('fill', '#0f172a')
    node.append('title').text((d: GraphNode) => {
      const info = courseInfo.get(d.id)
      return `${d.id}${info?.name ? ` — ${info.name}` : ''}${info?.hours ? ` — ${info.hours} credits` : ''}`
    })

    const simulation = d3.forceSimulation(nodes as GraphNode[])
      .force('link', d3.forceLink<GraphNode, GraphLink>(links).id((d) => d.id).distance(110))
      .force('charge', d3.forceManyBody().strength(-260))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(34))

    node.call(d3.drag<SVGGElement, GraphNode>()
      .on('start', (e) => { if (!e.active) simulation.alphaTarget(0.3).restart(); e.subject.fx = e.subject.x; e.subject.fy = e.subject.y })
      .on('drag', (e) => { e.subject.fx = Math.max(minX, Math.min(maxX, e.x)); e.subject.fy = Math.max(minY, Math.min(maxY, e.y)) })
      .on('end', (e) => { if (!e.active) simulation.alphaTarget(0); e.subject.fx = null; e.subject.fy = null })
    )

    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
    const resolveNode = (value: GraphNode | string) =>
      typeof value === 'string' ? nodeMap.get(value) ?? null : value

    simulation.on('tick', () => {
      nodes.forEach((d) => { d.x = clamp(d.x ?? width / 2, minX, maxX); d.y = clamp(d.y ?? height / 2, minY, maxY) })
      link
        .attr('x1', (d) => resolveNode(d.source)?.x ?? 0).attr('y1', (d) => resolveNode(d.source)?.y ?? 0)
        .attr('x2', (d) => resolveNode(d.target)?.x ?? 0).attr('y2', (d) => resolveNode(d.target)?.y ?? 0)
      node.attr('transform', (d: GraphNode) => `translate(${d.x ?? 0}, ${d.y ?? 0})`)
    })
    return () => { simulation.stop() }
  }, [graphData, layoutMode, zoomScale, activeView, completed])

  return (
    <main className="page">
      <section className="hero" id="top">
        <div className="band band--top" aria-hidden="true" />
        <div className="hero__inner">
          <h1>UIC Flame Map</h1>
          <p className="lead">
            An organized visual for your degree at UIC. Explore every course and see prerequisites.
          </p>
          <div className="hero__actions">
            <a className="btn btn--primary" href="#flowchart">Create my Flowchart</a>
            <a className="btn btn--ghost" href="#learn">Learn More</a>
          </div>
        </div>
        <div className="band band--bottom" aria-hidden="true" />
      </section>

      <section className="section section--flow" id="flowchart">
        <div className="section__inner">
          <div className="section__header">
            <p className="eyebrow">Start Here</p>
            <h2>Choose Your Major</h2>
            <p className="section__lead">We'll load the courses and build your visual flowchart instantly.</p>
          </div>
          <div className="flow-card">
            <label htmlFor="major-search" className="field__label">Major or Program</label>
            <div className="field__row">
              <div className="search">
                <input
                  id="major-search" name="major-search" type="text"
                  placeholder="Search for a major" value={query}
                  onChange={(e) => { setQuery(e.target.value); setSelectedMajorId(null); setActiveIndex(0); setResultsOpen(true) }}
                  onKeyDown={handleKeyDown}
                  onFocus={() => { if (normalizedQuery.length > 0) setResultsOpen(true) }}
                  onBlur={() => setTimeout(() => setResultsOpen(false), 120)}
                  disabled={isLoading || !!loadError}
                />
                {normalizedQuery.length > 0 && resultsOpen && (
                  <div className="search__results">
                    {matches.length === 0
                      ? <span className="search__empty">No matches yet. Try another keyword.</span>
                      : matches.map((major, index) => (
                        <button
                          key={major.id}
                          className={`search__item${index === activeIndex ? ' is-active' : ''}`}
                          type="button"
                          onClick={() => { setQuery(major.label); setSelectedMajorId(major.id); setResultsOpen(false) }}
                          onMouseEnter={() => setActiveIndex(index)}
                        >
                          {highlightMatch(major.label, query)}
                        </button>
                      ))
                    }
                  </div>
                )}
              </div>
              <button className="btn btn--primary" type="button" onClick={handleBuildMap}>Build My Map</button>
            </div>
            <p className="hint">
              {isLoading ? 'Loading majors from the UIC catalog...'
                : loadError ? `Error: ${loadError} (Is the backend running?)`
                : selectedMajorId ? `Selected: ${selectedMajorId}`
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
              <h2>Course Map</h2>
              <p className="section__lead">
                {activeView === 'graph'
                  ? 'Drag nodes to explore the prerequisite flow.'
                  : 'Click any course to see details. Check boxes to track your progress.'}
              </p>
            </div>

            <div className="graph-controls">
              {/* View toggle */}
              <button
                className={`btn btn--ghost${activeView === 'graph' ? ' is-active' : ''}`}
                type="button" onClick={() => setActiveView('graph')}
              >Graph View</button>
              <button
                className={`btn btn--ghost${activeView === 'path' ? ' is-active' : ''}`}
                type="button" onClick={() => setActiveView('path')}
              >Path View</button>
              <button
                className={`btn btn--ghost${activeView === 'radial' ? ' is-active' : ''}`}
                type="button" onClick={() => setActiveView('radial')}
              >Radial View</button>

              {/* Graph controls (only in graph view) */}
              {activeView === 'graph' && (
                <>
                  <span className="controls-divider" />
                  <button className={`btn btn--ghost${layoutMode === 'flow' ? ' is-active' : ''}`} type="button" onClick={() => setLayoutMode('flow')}>Flowchart</button>
                  <button className={`btn btn--ghost${layoutMode === 'force' ? ' is-active' : ''}`} type="button" onClick={() => setLayoutMode('force')}>Force</button>
                  {layoutMode === 'flow' && (
                    <button className="btn btn--ghost" type="button" onClick={() => setZoomScale((p) => Math.min(2, p + 0.2))}>Zoom In</button>
                  )}
                  {layoutMode === 'flow' && zoomScale > 1 && (
                    <button className="btn btn--ghost" type="button" onClick={() => setZoomScale((p) => Math.max(1, p - 0.2))}>Zoom Out</button>
                  )}
                </>
              )}

              {/* Completion counter */}
              {graphData && completed.size > 0 && (
                <span className="completion-badge">
                  {completed.size} / {graphData.nodes.length} done
                </span>
              )}
            </div>

            <div className="graph-card">
              {graphLoading && <p className="graph-status">Loading graph...</p>}
              {graphError && <p className="graph-status graph-status--error">{graphError}</p>}
              {!graphLoading && !graphError && graphData && (
                <>
                  {activeView === 'graph' && <div className="graph-canvas" ref={graphRef} />}
                  {activeView === 'path' && (
                    <PathView
                      nodes={graphData.nodes}
                      edges={graphData.edges}
                      completed={completed}
                      onToggle={toggleCompleted}
                    />
                  )}
                  {activeView === 'radial' && (
                    <RadialView
                      nodes={graphData.nodes}
                      edges={graphData.edges}
                      completed={completed}
                      onSelectCourse={fetchDetail}
                    />
                  )}
                </>
              )}
            </div>

            {/* Radial detail panel */}
            {activeView === 'radial' && radialSelected && (
              <div className="course-panel">
                <button
                  className="course-panel__close"
                  onClick={() => setRadialSelected(null)}
                  aria-label="Close"
                >
                  ✕
                </button>
                <p className="course-panel__id">{radialSelected.course_id}</p>
                <h3 className="course-panel__name">{radialSelected.name}</h3>
                <div className="course-panel__row">
                  <span>Credits</span>
                  <span>{radialSelected.hours}</span>
                </div>
                <div className="course-panel__row">
                  <span>Prerequisites</span>
                  <span>{radialSelected.prerequisites || 'None'}</span>
                </div>
                <p className="course-panel__desc">{radialSelected.description}</p>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="section section--learn" id="learn">
        <div className="section__inner">
          <div className="section__header">
            <p className="eyebrow">How It Works</p>
            <h2>From Catalog to Flowchart</h2>
            <p className="section__lead">We pull official UIC catalog data and map out prerequisites so you can plan semester by semester.</p>
          </div>
          <div className="steps">
            <article className="step"><h3>1. Pick Your Program</h3><p>Select your degree or concentration.</p></article>
            <article className="step"><h3>2. See the Graph</h3><p>An interactive map that shows which courses unlock the next ones.</p></article>
            <article className="step"><h3>3. Plan Your Path</h3><p>Mark completed courses to highlight what is available next.</p></article>
          </div>
        </div>
      </section>
    </main>
  )
}
