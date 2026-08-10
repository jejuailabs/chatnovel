import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; type: string }> }
) {
  try {
    const { id, type } = await params
    const bible = await db.bible.findUnique({
      where: { projectId_type: { projectId: id, type } },
    })
    if (!bible) {
      return NextResponse.json({ content: '{}', version: 0, type })
    }
    return NextResponse.json(bible)
  } catch (error) {
    console.error('Error fetching bible:', error)
    return NextResponse.json({ error: '바이블을 불러오지 못했습니다.' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; type: string }> }
) {
  try {
    const { id, type } = await params
    const body = await req.json()
    const { content, version } = body

    const existing = await db.bible.findUnique({
      where: { projectId_type: { projectId: id, type } },
    })

    if (!existing) {
      const bible = await db.bible.create({
        data: {
          projectId: id,
          type,
          content: typeof content === 'string' ? content : JSON.stringify(content || {}),
          version: version || 1,
        },
      })
      return NextResponse.json(bible)
    }

    const updated = await db.bible.update({
      where: { id: existing.id },
      data: {
        content: typeof content === 'string' ? content : JSON.stringify(content || {}),
        version: (version || existing.version) + (body.version === undefined ? 1 : 0),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating bible:', error)
    return NextResponse.json({ error: '바이블 수정에 실패했습니다.' }, { status: 500 })
  }
}
