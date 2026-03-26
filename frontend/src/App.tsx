import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import * as d3 from 'd3'
import './index.css'

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

    const nodeMap = new Map<string, { id: string }>()
    graphData.nodes.forEach((node) => {
      if (!nodeMap.has(node.id)) nodeMap.set(node.id, { id: node.id })
    })
    const nodes = Array.from(nodeMap.values())
    const nodeIds = new Set(nodes.map((node) => node.id))
    const links = graphData.edges
      .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
      .map((edge) => ({ source: edge.source, target: edge.target }))

    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', '100%')
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

    const link = svg
      .append('g')
      .attr('stroke', '#4b5563')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke-width', 1.2)
      .attr('marker-end', 'url(#arrow)')

    const node = svg
      .append('g')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .call(
        d3
          .drag<SVGGElement, { id: string }>()
          .on('start', (event) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            event.subject.fx = event.subject.x
            event.subject.fy = event.subject.y
          })
          .on('drag', (event) => {
            event.subject.fx = event.x
            event.subject.fy = event.y
          })
          .on('end', (event) => {
            if (!event.active) simulation.alphaTarget(0)
            event.subject.fx = null
            event.subject.fy = null
          })
      )

    node
      .append('circle')
      .attr('r', 12)
      .attr('fill', '#c8102e')

    node
      .append('text')
      .text((d) => d.id)
      .attr('x', 18)
      .attr('y', 4)
      .attr('font-size', '10px')
      .attr('fill', '#0f172a')

    const simulation = d3
      .forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force(
        'link',
        d3
          .forceLink(links)
          .id((d) => (d as { id: string }).id)
          .distance(110)
      )
      .force('charge', d3.forceManyBody().strength(-220))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(26))

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as { x: number }).x)
        .attr('y1', (d) => (d.source as { y: number }).y)
        .attr('x2', (d) => (d.target as { x: number }).x)
        .attr('y2', (d) => (d.target as { y: number }).y)

      node.attr(
        'transform',
        (d) => `translate(${(d as { x: number }).x}, ${(d as { y: number }).y})`
      )
    })

    return () => {
      simulation.stop()
    }
  }, [graphData])

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
