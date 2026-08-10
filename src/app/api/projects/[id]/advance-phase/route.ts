import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// Phase 1 → Phase 2 전환: project.phase=2 로 올리고 캐논 트래커를 초기화한다.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const project = await db.project.findUnique({ where: { id } })
    if (!project) {
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 확정 노드로 초기 트래커 시드 (캐릭터 이름 등)
    const nodes = await db.node.findMany({ where: { projectId: id } })
    const characterNames = nodes
      .filter((n: any) => {
        try {
          const tags = JSON.parse(n.tags || '[]')
          return Array.isArray(tags) && tags.some((t: string) => /캐릭터|인물/.test(t))
        } catch {
          return false
        }
      })
      .map((n: any) => n.title)

    const initialState = JSON.stringify({
      version: 'v1.0',
      timeline: { current_day: 0, current_season: '', notes: '' },
      characters: Object.fromEntries(
        characterNames.map((name: string) => [name, { status: '등장 전', last_scene: '' }])
      ),
      plots_planted: [],
      plots_resolved: [],
      locations_visited: [],
      sensory_anchors: {},
    })

    // 트래커 upsert
    const existingTracker = await db.canonTracker.findUnique({ where: { projectId: id } })
    let tracker
    if (existingTracker) {
      tracker = existingTracker
    } else {
      tracker = await db.canonTracker.create({
        data: { projectId: id, state: initialState, version: 1 },
      })
    }

    const updated = await db.project.update({
      where: { id },
      data: { phase: 2 },
    })

    return NextResponse.json({ project: updated, canonTracker: tracker })
  } catch (error) {
    console.error('advance-phase error:', error)
    return NextResponse.json({ error: 'Phase 2 전환에 실패했습니다.' }, { status: 500 })
  }
}
