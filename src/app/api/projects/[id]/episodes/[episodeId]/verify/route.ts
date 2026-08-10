import { db } from '@/lib/db'
import { complete, extractJson, EPISODE_PRESET } from '@/lib/ai'
import { NextRequest, NextResponse } from 'next/server'

const VERIFY_PROMPT = `당신은 웹소설 연속성 검수자입니다.
'성경(설정)'과 '캐논 트래커(현재 상태)'를 기준으로 '검수할 회차 원고'가 어긋나는 지점을 찾아내세요.

점검 항목: 인물(나이·직업·말투·성격), 로케이션, 시간선(며칠째·계절), 성경의 필수 어구, 심은 복선의 회수 여부.

반드시 아래 스키마의 JSON 객체 하나만 출력하세요 (설명·코드펜스 없이):
{
  "consistent": true 또는 false,
  "issues": [
    {"type":"인물|로케이션|시간선|필수어구|복선","severity":"high|medium|low","detail":"무엇이 어떻게 어긋났는지 구체적으로","source":"성경|트래커","suggestion":"해결 제안(원고 수정/성경 개정/트래커 개정 중 무엇인지)"}
  ]
}
어긋남이 없으면 "consistent": true, "issues": [] 로 출력하세요. 한국어로 작성하세요.`

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; episodeId: string }> }
) {
  try {
    const { id, episodeId } = await params
    const episode = await db.episode.findUnique({ where: { id: episodeId } })
    if (!episode || !episode.content?.trim()) {
      return NextResponse.json({ error: '검수할 원고 내용이 없습니다.' }, { status: 400 })
    }

    const [bibles, tracker] = await Promise.all([
      db.bible.findMany({ where: { projectId: id } }),
      db.canonTracker.findUnique({ where: { projectId: id } }),
    ])

    const bibleContent = bibles.map((b: any) => `[${b.type}]\n${b.content}`).join('\n\n')
    const trackerState = tracker?.state || '{}'

    const out = await complete(
      [
        { role: 'system', content: VERIFY_PROMPT },
        {
          role: 'user',
          content: `--- 성경 ---\n${bibleContent || '(없음)'}\n\n--- 캐논 트래커 ---\n${trackerState}\n\n--- 검수할 회차 (${episode.bu}부 ${episode.hwa}화) ---\n${episode.content}`,
        },
      ],
      EPISODE_PRESET
    )

    const parsed = extractJson<{ consistent: boolean; issues: any[] }>(out)
    if (!parsed) {
      return NextResponse.json({ error: '검증 결과를 해석하지 못했습니다. 다시 시도해 주세요.' }, { status: 502 })
    }

    return NextResponse.json({
      consistent: parsed.consistent !== false && (parsed.issues?.length ?? 0) === 0,
      issues: parsed.issues || [],
    })
  } catch (error) {
    console.error('verify error:', error)
    const msg = error instanceof Error ? error.message : '일관성 검증에 실패했습니다.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
