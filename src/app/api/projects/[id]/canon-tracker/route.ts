import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const tracker = await db.canonTracker.findUnique({
      where: { projectId: id },
    })
    if (!tracker) {
      return NextResponse.json({ state: '{}', version: 0 })
    }
    return NextResponse.json(tracker)
  } catch (error) {
    console.error('Error fetching canon tracker:', error)
    return NextResponse.json({ error: '캐논 트래커를 불러오지 못했습니다.' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { state, version } = body

    const existing = await db.canonTracker.findUnique({
      where: { projectId: id },
    })

    if (existing) {
      const updated = await db.canonTracker.update({
        where: { projectId: id },
        data: {
          state: typeof state === 'string' ? state : JSON.stringify(state || {}),
          lastUpdated: new Date(),
          ...(version !== undefined && { version }),
        },
      })
      return NextResponse.json(updated)
    }

    const tracker = await db.canonTracker.create({
      data: {
        projectId: id,
        state: typeof state === 'string' ? state : JSON.stringify(state || {}),
        version: version || 1,
      },
    })

    return NextResponse.json(tracker, { status: 201 })
  } catch (error) {
    console.error('Error creating/updating canon tracker:', error)
    return NextResponse.json({ error: '캐논 트래커 저장에 실패했습니다.' }, { status: 500 })
  }
}
