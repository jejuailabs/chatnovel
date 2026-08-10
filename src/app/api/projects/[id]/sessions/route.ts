import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sessions = await db.session.findMany({
      where: { projectId: id },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true, nodes: true } } },
    })
    return NextResponse.json(sessions)
  } catch (error) {
    console.error('Error fetching sessions:', error)
    return NextResponse.json({ error: '세션을 불러오지 못했습니다.' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { type, title } = body

    const session = await db.session.create({
      data: {
        projectId: id,
        type: type || 'brainstorm',
        title: title || '새 브레인스토밍',
      },
    })

    return NextResponse.json(session, { status: 201 })
  } catch (error) {
    console.error('Error creating session:', error)
    return NextResponse.json({ error: '세션 생성에 실패했습니다.' }, { status: 500 })
  }
}
