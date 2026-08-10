import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const bibles = await db.bible.findMany({
      where: { projectId: id },
      orderBy: { type: 'asc' },
    })
    return NextResponse.json(bibles)
  } catch (error) {
    console.error('Error fetching bibles:', error)
    return NextResponse.json({ error: '바이블을 불러오지 못했습니다.' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { type, content, version } = body

    const existing = await db.bible.findUnique({
      where: { projectId_type: { projectId: id, type: type || 'concept' } },
    })

    if (existing) {
      const updated = await db.bible.update({
        where: { id: existing.id },
        data: {
          content: typeof content === 'string' ? content : JSON.stringify(content || {}),
          ...(version !== undefined && { version }),
        },
      })
      return NextResponse.json(updated)
    }

    const bible = await db.bible.create({
      data: {
        projectId: id,
        type: type || 'concept',
        content: typeof content === 'string' ? content : JSON.stringify(content || {}),
        version: version || 1,
      },
    })

    return NextResponse.json(bible, { status: 201 })
  } catch (error) {
    console.error('Error creating/updating bible:', error)
    return NextResponse.json({ error: '바이블 저장에 실패했습니다.' }, { status: 500 })
  }
}
