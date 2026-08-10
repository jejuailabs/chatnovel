import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const nodes = await db.node.findMany({
      where: { projectId: id },
      orderBy: { updatedAt: 'desc' },
    })
    return NextResponse.json(nodes)
  } catch (error) {
    console.error('Error fetching nodes:', error)
    return NextResponse.json({ error: '노드를 불러오지 못했습니다.' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { title, content, tags, status, sessionId, originMessageId } = body

    const node = await db.node.create({
      data: {
        projectId: id,
        title: title || '제목 없음',
        content: content || '',
        tags: typeof tags === 'string' ? tags : JSON.stringify(tags || []),
        status: status || 'evolving',
        ...(sessionId && { sessionId }),
        ...(originMessageId && { originMessageId }),
      },
    })

    return NextResponse.json(node, { status: 201 })
  } catch (error) {
    console.error('Error creating node:', error)
    return NextResponse.json({ error: '노드 생성에 실패했습니다.' }, { status: 500 })
  }
}
