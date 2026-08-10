import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const nodes = await db.node.findMany({ where: { projectId: id } })
    const nodeIds = new Set(nodes.map((n: any) => n.id))

    const allLinks = await db.nodeLink.findMany({})
    const projectLinks = allLinks.filter(
      (l: any) => nodeIds.has(l.parentId) || nodeIds.has(l.childId)
    )
    return NextResponse.json(projectLinks)
  } catch (error) {
    console.error('Error fetching node links:', error)
    return NextResponse.json([], { status: 200 })
  }
}
