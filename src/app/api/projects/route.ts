import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const projects = await db.project.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { nodes: true, episodes: true, sessions: true } },
      },
    })
    return NextResponse.json(projects)
  } catch (error) {
    console.error('Error fetching projects:', error)
    return NextResponse.json({ error: '프로젝트를 불러오지 못했습니다.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, genre, targetLength } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: '프로젝트 제목을 입력해주세요.' }, { status: 400 })
    }

    const project = await db.project.create({
      data: {
        title: title.trim(),
        genre: genre || '웹소설',
        targetLength: targetLength || 144,
        phase: 1,
      },
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error('Error creating project:', error)
    return NextResponse.json({ error: '프로젝트 생성에 실패했습니다.' }, { status: 500 })
  }
}
