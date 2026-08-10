import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

async function getEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  // Use Anthropic's text processing to create a simple hash-based embedding
  // For production, switch to a dedicated embedding model (OpenAI ada-002, Cohere, etc.)
  const words = text.toLowerCase().replace(/[^\w\s가-힣]/g, '').split(/\s+/).filter(Boolean)
  const dim = 128
  const vec = new Array(dim).fill(0)
  for (const word of words) {
    let hash = 0
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash + word.charCodeAt(i)) | 0
    }
    for (let d = 0; d < dim; d++) {
      const h2 = ((hash * (d + 1) * 2654435761) | 0) >>> 0
      vec[d] += ((h2 % 200) - 100) / 100
    }
  }
  // Normalize
  const mag = Math.sqrt(vec.reduce((s: number, v: number) => s + v * v, 0)) || 1
  return vec.map((v: number) => v / mag)
}

function cosine(a: number[], b: number[]): number {
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return dot
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { query, type = 'nodes', limit = 10 } = await req.json()

    if (!query?.trim()) {
      return NextResponse.json({ error: '검색어를 입력하세요.' }, { status: 400 })
    }

    const queryVec = await getEmbedding(query)

    if (type === 'nodes' || type === 'all') {
      const nodes = await db.node.findMany({ where: { projectId: id } })
      const results = nodes
        .filter((n: any) => n.status !== 'discarded')
        .map((n: any) => {
          const text = `${n.title} ${n.content} ${n.tags}`
          // Text match score
          const lq = query.toLowerCase()
          const lt = text.toLowerCase()
          let textScore = 0
          if (lt.includes(lq)) textScore = 1
          else {
            const qWords = lq.split(/\s+/)
            textScore = qWords.filter((w: string) => lt.includes(w)).length / qWords.length
          }

          // Vector score
          let vecScore = 0
          if (queryVec) {
            const nodeVec = getEmbeddingSync(`${n.title} ${n.content}`)
            if (nodeVec) vecScore = cosine(queryVec, nodeVec)
          }

          const score = textScore * 0.6 + vecScore * 0.4
          return { ...n, _score: score, _type: 'node' as const }
        })
        .filter((r: any) => r._score > 0.1)
        .sort((a: any, b: any) => b._score - a._score)
        .slice(0, limit)

      if (type === 'nodes') return NextResponse.json(results)

      // Also search episodes if type === 'all'
      const episodes = await db.episode.findMany({ where: { projectId: id } })
      const epResults = episodes
        .filter((e: any) => e.content?.trim())
        .map((e: any) => {
          const text = `${e.bu}부 ${e.hwa}화 ${e.content}`
          const lq = query.toLowerCase()
          const lt = text.toLowerCase()
          let score = 0
          if (lt.includes(lq)) score = 1
          else {
            const qWords = lq.split(/\s+/)
            score = qWords.filter((w: string) => lt.includes(w)).length / qWords.length
          }
          return { id: e.id, bu: e.bu, hwa: e.hwa, snippet: getSnippet(e.content, query), _score: score, _type: 'episode' as const }
        })
        .filter((r: any) => r._score > 0.1)
        .sort((a: any, b: any) => b._score - a._score)
        .slice(0, limit)

      return NextResponse.json([...results, ...epResults].sort((a, b) => b._score - a._score).slice(0, limit))
    }

    if (type === 'episodes') {
      const episodes = await db.episode.findMany({ where: { projectId: id } })
      const results = episodes
        .filter((e: any) => e.content?.trim())
        .map((e: any) => {
          const text = `${e.bu}부 ${e.hwa}화 ${e.content}`
          const lq = query.toLowerCase()
          const lt = text.toLowerCase()
          let score = 0
          if (lt.includes(lq)) score = 1
          else {
            const qWords = lq.split(/\s+/)
            score = qWords.filter((w: string) => lt.includes(w)).length / qWords.length
          }
          return { id: e.id, bu: e.bu, hwa: e.hwa, snippet: getSnippet(e.content, query), _score: score, _type: 'episode' as const }
        })
        .filter((r: any) => r._score > 0.1)
        .sort((a: any, b: any) => b._score - a._score)
        .slice(0, limit)

      return NextResponse.json(results)
    }

    return NextResponse.json([])
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ error: '검색에 실패했습니다.' }, { status: 500 })
  }
}

function getEmbeddingSync(text: string): number[] | null {
  const words = text.toLowerCase().replace(/[^\w\s가-힣]/g, '').split(/\s+/).filter(Boolean)
  const dim = 128
  const vec = new Array(dim).fill(0)
  for (const word of words) {
    let hash = 0
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash + word.charCodeAt(i)) | 0
    }
    for (let d = 0; d < dim; d++) {
      const h2 = ((hash * (d + 1) * 2654435761) | 0) >>> 0
      vec[d] += ((h2 % 200) - 100) / 100
    }
  }
  const mag = Math.sqrt(vec.reduce((s: number, v: number) => s + v * v, 0)) || 1
  return vec.map((v: number) => v / mag)
}

function getSnippet(content: string, query: string, chars = 120): string {
  const idx = content.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return content.slice(0, chars) + '...'
  const start = Math.max(0, idx - 40)
  const end = Math.min(content.length, idx + query.length + 80)
  return (start > 0 ? '...' : '') + content.slice(start, end) + (end < content.length ? '...' : '')
}
