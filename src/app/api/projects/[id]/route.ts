import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const project = await db.project.findUnique({
      where: { id },
      include: {
        sessions: { orderBy: { updatedAt: 'desc' } },
        nodes: { orderBy: { updatedAt: 'desc' } },
        bibles: true,
        canonTracker: true,
        episodes: { orderBy: [{ bu: 'asc' }, { hwa: 'asc' }] },
        metrics: { orderBy: { createdAt: 'desc' }, take: 100 },
      },
    })

    if (!project) {
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json(project)
  } catch (error) {
    console.error('Error fetching project:', error)
    return NextResponse.json({ error: '프로젝트를 불러오지 못했습니다.' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { title, genre, targetLength, phase } = body

    const project = await db.project.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(genre !== undefined && { genre }),
        ...(targetLength !== undefined && { targetLength }),
        ...(phase !== undefined && { phase }),
      },
    })

    return NextResponse.json(project)
  } catch (error) {
    console.error('Error updating project:', error)
    return NextResponse.json({ error: '프로젝트 수정에 실패했습니다.' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.project.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting project:', error)
    return NextResponse.json({ error: '프로젝트 삭제에 실패했습니다.' }, { status: 500 })
  }
}
