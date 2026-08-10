import { db } from '@/lib/db'
import { complete, extractJson, GENESIS_PRESET } from '@/lib/ai'
import { NextRequest, NextResponse } from 'next/server'

// 기존에 가진 성경/설정 원문(자유 형식)을 성경 3종 스키마로 정리한다.
const STRUCTURE_PROMPT = `당신은 IP 기획 편집자입니다.
사용자가 붙여넣은 기존 설정/기획/성경 원문을 분석하여, 제작에 바로 쓸 수 있는 성경(Bible) 3종을 JSON으로 정리하세요.
원문에 있는 정보는 최대한 보존하고, 빈 칸은 원문 근거로 추론해 채우되 근거가 없으면 빈 문자열/빈 배열로 두세요.

반드시 아래 스키마의 JSON 객체 하나만 출력하세요 (설명·코드펜스 없이):
{
  "concept": {"title":"","logline":"","theme":"","targetAudience":"","genre":"","setting":"","coreConflict":"","characters":[{"name":"","role":"","description":""}],"worldBuilding":""},
  "production": {"characters":[{"name":"","age":"","job":"","personality":"","speechStyle":"","arc":""}],"locations":[{"name":"","description":""}],"timeline":"","rules":"","items":[{"name":"","meaning":""}],"relationships":[{"from":"","to":"","relation":""}]},
  "log": {"decisions":[],"changes":[],"notes":[]}
}
한국어로 작성하세요.`

async function upsertBible(projectId: string, type: string, content: string) {
  const existing = await db.bible.findUnique({
    where: { projectId_type: { projectId, type } },
  })
  if (existing) {
    return db.bible.update({
      where: { id: existing.id },
      data: { content, version: (existing.version || 0) + 1 },
    })
  }
  return db.bible.create({ data: { projectId, type, content, version: 1 } })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const project = await db.project.findUnique({ where: { id } })
    if (!project) {
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 })
    }

    const body = await req.json()

    // 1) 특정 성경 한 종을 원문 그대로 주입 (structured 이미 보유)
    if (body.type && typeof body.content === 'string') {
      const saved = await upsertBible(id, body.type, body.content)
      return NextResponse.json({ bibles: [saved] })
    }

    // 2) 자유 원문 → AI가 3종으로 정리
    const text: string = body.text || ''
    if (!text.trim()) {
      return NextResponse.json({ error: '가져올 원문을 입력해 주세요.' }, { status: 400 })
    }

    const out = await complete(
      [
        { role: 'system', content: STRUCTURE_PROMPT },
        { role: 'user', content: `프로젝트: ${project.title} (${project.genre})\n\n--- 기존 성경/설정 원문 ---\n${text}` },
      ],
      GENESIS_PRESET
    )

    const parsed = extractJson<{ concept: any; production: any; log: any }>(out)
    if (!parsed) {
      return NextResponse.json(
        { error: 'AI가 원문을 성경 형식으로 변환하지 못했습니다. 원문을 더 구체적으로 입력하거나 다시 시도해 주세요.' },
        { status: 502 }
      )
    }

    const saved = []
    for (const type of ['concept', 'production', 'log'] as const) {
      saved.push(await upsertBible(id, type, JSON.stringify(parsed[type] ?? {}, null, 2)))
    }
    return NextResponse.json({ bibles: saved })
  } catch (error) {
    console.error('import-bible error:', error)
    const msg = error instanceof Error ? error.message : '성경 가져오기에 실패했습니다.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
