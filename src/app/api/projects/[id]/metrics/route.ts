import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const metrics = await db.metric.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    const summary = await db.metric.aggregate({
      where: { projectId: id },
      _sum: { inputTokens: true, outputTokens: true, costKrw: true },
      _count: true,
    })

    return NextResponse.json({ metrics, summary })
  } catch (error) {
    console.error('Error fetching metrics:', error)
    return NextResponse.json({ error: '메트릭을 불러오지 못했습니다.' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { eventType, entityId, inputTokens, outputTokens, costKrw } = body

    const metric = await db.metric.create({
      data: {
        projectId: id,
        eventType: eventType || 'chat',
        entityId: entityId || '',
        inputTokens: inputTokens || 0,
        outputTokens: outputTokens || 0,
        costKrw: costKrw || 0,
      },
    })

    return NextResponse.json(metric, { status: 201 })
  } catch (error) {
    console.error('Error creating metric:', error)
    return NextResponse.json({ error: '메트릭 저장에 실패했습니다.' }, { status: 500 })
  }
}
