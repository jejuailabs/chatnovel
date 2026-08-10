import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; nodeId: string }> }
) {
  try {
    const { nodeId } = await params
    const body = await req.json()
    const { title, content, tags, status } = body

    const node = await db.node.update({
      where: { id: nodeId },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(tags !== undefined && { tags: typeof tags === 'string' ? tags : JSON.stringify(tags) }),
        ...(status !== undefined && { status }),
      },
    })

    return NextResponse.json(node)
  } catch (error) {
    console.error('Error updating node:', error)
    return NextResponse.json({ error: '노드 수정에 실패했습니다.' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; nodeId: string }> }
) {
  try {
    const { nodeId } = await params
    await db.node.delete({ where: { id: nodeId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting node:', error)
    return NextResponse.json({ error: '노드 삭제에 실패했습니다.' }, { status: 500 })
  }
}
