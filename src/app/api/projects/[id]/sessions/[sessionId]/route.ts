import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    // Delete messages first, then session
    const messages = await db.message.findMany({ where: { sessionId } })
    for (const m of messages) {
      await db.message.delete({ where: { id: m.id } })
    }
    await db.session.delete({ where: { id: sessionId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting session:', error)
    return NextResponse.json({ error: '세션 삭제에 실패했습니다.' }, { status: 500 })
  }
}
