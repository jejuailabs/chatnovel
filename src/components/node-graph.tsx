'use client'

import { useMemo, useState, useRef, useCallback } from 'react'
import { useAppStore } from '@/lib/store'

const STATUS_COLOR: Record<string, string> = {
  confirmed: '#10b981',
  evolving: '#f59e0b',
  pending: '#9ca3af',
  discarded: '#ef4444',
}

function firstTag(tags: string): string {
  try {
    const arr = JSON.parse(tags || '[]')
    if (Array.isArray(arr) && arr.length > 0) return String(arr[0])
  } catch {}
  return '기타'
}

function allTags(tags: string): string[] {
  try {
    const arr = JSON.parse(tags || '[]')
    if (Array.isArray(arr)) return arr.map(String)
  } catch {}
  return []
}

type NodeLink = { parentId: string; childId: string }

export default function NodeGraph() {
  const { nodes, selectedNodeId, setSelectedNodeId, currentProject } = useAppStore()
  const [links, setLinks] = useState<NodeLink[]>([])
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // Fetch node links
  useMemo(() => {
    if (!currentProject) return
    fetch(`/api/projects/${currentProject.id}/node-links`)
      .then((r) => r.ok ? r.json() : [])
      .then((d: NodeLink[]) => setLinks(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [currentProject?.id, nodes.length])

  const layout = useMemo(() => {
    const W = 1200
    const H = 800
    const cx = W / 2
    const cy = H / 2
    const active = nodes.filter((n) => n.status !== 'discarded')

    const groups = new Map<string, typeof nodes>()
    for (const n of active) {
      const g = firstTag(n.tags)
      const list = groups.get(g) || []
      list.push(n)
      groups.set(g, list)
    }
    const cats = [...groups.keys()]
    const C = Math.max(1, cats.length)
    const R = Math.min(cx, cy) - 160

    const positioned: {
      id: string
      title: string
      content: string
      status: string
      tags: string[]
      x: number
      y: number
      cat: string
    }[] = []
    const catCenters: { cat: string; x: number; y: number; count: number }[] = []

    cats.forEach((cat, ci) => {
      const angle = (2 * Math.PI * ci) / C - Math.PI / 2
      const gx = C === 1 ? cx : cx + R * Math.cos(angle)
      const gy = C === 1 ? cy : cy + R * Math.sin(angle)
      const list = groups.get(cat)!
      catCenters.push({ cat, x: gx, y: gy, count: list.length })
      const k = list.length
      const rr = Math.min(100, 30 + k * 8)
      list.forEach((n, ni) => {
        const a = (2 * Math.PI * ni) / Math.max(1, k) - Math.PI / 2
        const x = k === 1 ? gx : gx + rr * Math.cos(a)
        const y = k === 1 ? gy : gy + rr * Math.sin(a)
        positioned.push({ id: n.id, title: n.title, content: n.content, status: n.status, tags: allTags(n.tags), x, y, cat })
      })
    })

    return { W, H, cx, cy, positioned, catCenters }
  }, [nodes])

  const posMap = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>()
    layout.positioned.forEach((p) => m.set(p.id, { x: p.x, y: p.y }))
    return m
  }, [layout])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom((z) => Math.max(0.3, Math.min(3, z - e.deltaY * 0.001)))
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && (e.target as SVGElement).tagName === 'svg') {
      setDragging(true)
      lastMouse.current = { x: e.clientX, y: e.clientY }
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return
    const dx = e.clientX - lastMouse.current.x
    const dy = e.clientY - lastMouse.current.y
    lastMouse.current = { x: e.clientX, y: e.clientY }
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }))
  }, [dragging])

  const handleMouseUp = useCallback(() => setDragging(false), [])

  const hoveredOrSelected = hoveredNode || selectedNodeId
  const highlightedLinks = useMemo(() => {
    if (!hoveredOrSelected) return new Set<string>()
    const s = new Set<string>()
    links.forEach((l) => {
      if (l.parentId === hoveredOrSelected || l.childId === hoveredOrSelected) {
        s.add(`${l.parentId}-${l.childId}`)
      }
    })
    return s
  }, [hoveredOrSelected, links])

  if (nodes.filter((n) => n.status !== 'discarded').length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
        표시할 노드가 없습니다. 채팅으로 아이디어를 확장해 노드를 만들어보세요.
      </div>
    )
  }

  const selectedPos = layout.positioned.find((p) => p.id === selectedNodeId)

  return (
    <div className="h-full flex flex-col">
      <div
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${layout.W} ${layout.H}`}
          className="w-full h-full"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <defs>
            <marker id="arrow" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 3 L 0 6 z" fill="currentColor" className="text-muted-foreground" />
            </marker>
          </defs>

          {/* Category group backgrounds */}
          {layout.catCenters.map((c) => (
            <circle
              key={`bg-${c.cat}`}
              cx={c.x}
              cy={c.y}
              r={Math.min(120, 40 + c.count * 12)}
              fill="currentColor"
              className="text-muted/5"
              stroke="currentColor"
              strokeWidth={0.5}
              strokeDasharray="4 4"
              opacity={0.4}
            />
          ))}

          {/* Center → category links */}
          {layout.catCenters.map((c) => (
            <line
              key={`cl-${c.cat}`}
              x1={layout.cx} y1={layout.cy}
              x2={c.x} y2={c.y}
              stroke="currentColor"
              className="text-border"
              strokeWidth={1}
              strokeDasharray="6 3"
            />
          ))}

          {/* NodeLink connections (parent → child) */}
          {links.map((l) => {
            const p = posMap.get(l.parentId)
            const c = posMap.get(l.childId)
            if (!p || !c) return null
            const key = `${l.parentId}-${l.childId}`
            const highlighted = highlightedLinks.has(key)
            return (
              <line
                key={`link-${key}`}
                x1={p.x} y1={p.y}
                x2={c.x} y2={c.y}
                stroke={highlighted ? '#f59e0b' : 'currentColor'}
                className={highlighted ? '' : 'text-muted-foreground/30'}
                strokeWidth={highlighted ? 2 : 1}
                markerEnd="url(#arrow)"
              />
            )
          })}

          {/* Category labels */}
          {layout.catCenters.map((c) => (
            <g key={`ct-${c.cat}`}>
              <rect
                x={c.x - 30} y={c.y - 25}
                width={60} height={18}
                rx={4}
                fill="currentColor"
                className="text-background"
                opacity={0.8}
              />
              <text
                x={c.x} y={c.y - 12}
                textAnchor="middle"
                className="fill-foreground"
                fontSize={11}
                fontWeight={600}
              >
                {c.cat}
              </text>
            </g>
          ))}

          {/* Center hub */}
          <circle cx={layout.cx} cy={layout.cy} r={14} className="fill-amber-500" />
          <text x={layout.cx} y={layout.cy + 4} textAnchor="middle" fill="white" fontSize={10} fontWeight={700}>
            IP
          </text>

          {/* Nodes */}
          {layout.positioned.map((p) => {
            const sel = p.id === selectedNodeId
            const hovered = p.id === hoveredNode
            const r = sel ? 10 : hovered ? 8 : 6
            return (
              <g
                key={p.id}
                onClick={(e) => { e.stopPropagation(); setSelectedNodeId(sel ? null : p.id) }}
                onMouseEnter={() => setHoveredNode(p.id)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: 'pointer' }}
              >
                {(sel || hovered) && (
                  <circle cx={p.x} cy={p.y} r={r + 4} fill="none" stroke={STATUS_COLOR[p.status] || '#9ca3af'} strokeWidth={1} opacity={0.4} />
                )}
                <circle
                  cx={p.x} cy={p.y}
                  r={r}
                  fill={STATUS_COLOR[p.status] || '#9ca3af'}
                  stroke={sel ? '#f59e0b' : 'white'}
                  strokeWidth={sel ? 3 : 1.5}
                />
                <text x={p.x} y={p.y + r + 14} textAnchor="middle" className="fill-foreground" fontSize={10}>
                  {p.title.length > 12 ? p.title.slice(0, 12) + '...' : p.title}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Bottom bar: legend + zoom controls + selected detail */}
      <div className="border-t border-border px-3 py-2 flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          {Object.entries({ confirmed: '확정', evolving: '진화 중', pending: '대기' }).map(([k, label]) => (
            <span key={k} className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[k] }} />
              {label}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => setZoom((z) => Math.max(0.3, z - 0.2))} className="px-1.5 py-0.5 rounded hover:bg-muted">−</button>
          <span className="w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(3, z + 0.2))} className="px-1.5 py-0.5 rounded hover:bg-muted">+</button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} className="px-1.5 py-0.5 rounded hover:bg-muted ml-1">리셋</button>
        </div>
      </div>

      {/* Selected node detail panel */}
      {selectedPos && (
        <div className="border-t border-border p-3 bg-muted/30 max-h-40 overflow-y-auto">
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[selectedPos.status] }} />
            <span className="font-medium text-sm">{selectedPos.title}</span>
            {selectedPos.tags.length > 0 && (
              <span className="text-xs text-muted-foreground">{selectedPos.tags.join(', ')}</span>
            )}
          </div>
          {selectedPos.content && (
            <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">{selectedPos.content}</p>
          )}
        </div>
      )}
    </div>
  )
}
