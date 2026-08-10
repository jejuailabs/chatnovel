import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; episodeId: string }> }
) {
  try {
    const { episodeId } = await params
    const episode = await db.episode.findUnique({
      where: { id: episodeId },
      include: {
        revisions: { orderBy: { version: 'desc' } },
      },
    })
    if (!episode) {
      return NextResponse.json({ error: '에피소드를 찾을 수 없습니다.' }, { status: 404 })
    }
    return NextResponse.json(episode)
  } catch (error) {
    console.error('Error fetching episode:', error)
    return NextResponse.json({ error: '에피소드를 불러오지 못했습니다.' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; episodeId: string }> }
) {
  try {
    const { episodeId } = await params
    const body = await req.json()
    const { content, status, wordCount, tokenUsed, costKrw } = body

    const episode = await db.episode.update({
      where: { id: episodeId },
      data: {
        ...(content !== undefined && { content }),
        ...(status !== undefined && { status }),
        ...(wordCount !== undefined && { wordCount }),
        ...(tokenUsed !== undefined && { tokenUsed }),
        ...(costKrw !== undefined && { costKrw }),
        ...(status === 'approved' && { approvedAt: new Date() }),
      },
    })

    return NextResponse.json(episode)
  } catch (error) {
    console.error('Error updating episode:', error)
    return NextResponse.json({ error: '에피소드 수정에 실패했습니다.' }, { status: 500 })
  }
}