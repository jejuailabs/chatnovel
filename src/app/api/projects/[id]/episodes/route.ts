import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const episodes = await db.episode.findMany({
      where: { projectId: id },
      orderBy: [{ bu: 'asc' }, { hwa: 'asc' }],
    })
    return NextResponse.json(episodes)
  } catch (error) {
    console.error('Error fetching episodes:', error)
    return NextResponse.json({ error: '에피소드를 불러오지 못했습니다.' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { bu, hwa } = body

    const existing = await db.episode.findUnique({
      where: { projectId_bu_hwa: { projectId: id, bu, hwa } },
    })

    if (existing) {
      return NextResponse.json({ error: '이미 존재하는 에피소드입니다.' }, { status: 409 })
    }

    const episode = await db.episode.create({
      data: { projectId: id, bu, hwa },
    })

    return NextResponse.json(episode, { status: 201 })
  } catch (error) {
    console.error('Error creating episode:', error)
    return NextResponse.json({ error: '에피소드 생성에 실패했습니다.' }, { status: 500 })
  }
}
