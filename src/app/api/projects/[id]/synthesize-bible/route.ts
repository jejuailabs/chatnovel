import { db } from '@/lib/db'
import { complete, extractJson, GENESIS_PRESET } from '@/lib/ai'
import { NextRequest, NextResponse } from 'next/server'

// 확정/진화 노드를 재료로 AI가 성경 3종(기획서/제작성경/창작로그)을 채운다.
const SYNTH_PROMPT = `당신은 웹소설·웹툰·드라마 IP 기획 전문가입니다.
아래 "확정된 노드"들을 종합하여 제작에 바로 쓸 수 있는 성경(Bible) 3종을 JSON으로 작성하세요.

반드시 아래 스키마의 JSON 객체 하나만 출력하세요 (설명·코드펜스 없이):
{
  "concept": {
    "title": "작품 제목",
    "logline": "한 줄 요약",
    "theme": "주제의식",
    "targetAudience": "타겟 독자",
    "genre": "장르",
    "setting": "배경 설정",
    "coreConflict": "핵심 갈등",
    "characters": [{"name":"이름","role":"역할","description":"설명"}],
    "worldBuilding": "세계관 요약"
  },
  "production": {
    "characters": [{"name":"이름","age":"나이","job":"직업","personality":"성격","speechStyle":"말투","arc":"성장선"}],
    "locations": [{"name":"장소","description":"설명"}],
    "timeline": "시간선/계절/주요 사건 순서",
    "rules": "세계관 규칙·설정",
    "items": [{"name":"소재/아이템","meaning":"의미"}],
    "relationships": [{"from":"A","to":"B","relation":"관계"}]
  },
  "log": {
    "decisions": ["확정된 핵심 결정들"],
    "changes": ["진화/변경 이력"],
    "notes": ["미결 사항·향후 확장 포인트"]
  }
}

빈 칸은 노드 내용을 근거로 추론해 채우되, 근거가 전혀 없으면 빈 문자열/빈 배열로 두세요. 한국어로 작성하세요.`

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const project = await db.project.findUnique({ where: { id } })
    if (!project) {
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 })
    }

    const nodes = await db.node.findMany({ where: { projectId: id } })
    const material = nodes
      .filter((n: any) => n.status === 'confirmed' || n.status === 'evolving')
      .map((n: any) => `- [${n.status}] ${n.title}: ${n.content}`)
      .join('\n')

    if (!material.trim()) {
      return NextResponse.json(
        { error: '성경을 만들 재료가 없습니다. 먼저 노드를 확정해 주세요.' },
        { status: 400 }
      )
    }

    const text = await complete(
      [
        { role: 'system', content: SYNTH_PROMPT },
        { role: 'user', content: `프로젝트: ${project.title} (${project.genre}, 목표 ${project.targetLength}화)\n\n--- 확정 노드 ---\n${material}` },
      ],
      GENESIS_PRESET
    )

    const parsed = extractJson<{ concept: any; production: any; log: any }>(text)
    if (!parsed) {
      return NextResponse.json(
        { error: 'AI 응답을 성경 형식으로 변환하지 못했습니다. 다시 시도해 주세요.' },
        { status: 502 }
      )
    }

    const saved: Record<string, any> = {}
    for (const type of ['concept', 'production', 'log'] as const) {
      const content = JSON.stringify(parsed[type] ?? {}, null, 2)
      const existing = await db.bible.findUnique({
        where: { projectId_type: { projectId: id, type } },
      })
      if (existing) {
        saved[type] = await db.bible.update({
          where: { id: existing.id },
          data: { content, version: (existing.version || 0) + 1 },
        })
      } else {
        saved[type] = await db.bible.create({
          data: { projectId: id, type, content, version: 1 },
        })
      }
    }

    return NextResponse.json({ bibles: Object.values(saved) })
  } catch (error) {
    console.error('synthesize-bible error:', error)
    const msg = error instanceof Error ? error.message : '성경 자동 생성에 실패했습니다.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
